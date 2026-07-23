import type {
  TsxGenerateOptions,
  TsxEditOptions,
  TsxEditPipelineOptions,
  TsxPipelineOptions,
  TsxPipelineResult,
  GenerateResult,
  PipelineProgress,
  PipelineStepLog,
  PipelineMode,
  ThinkingLevel,
} from './types';
import type {
  LlmImageIpc,
  LlmGenerateRequest,
  LlmGenerateResponse,
  TsxValidateRequest,
  TsxValidateResponse,
} from '../ipc/types';
import { THINKING_CONFIGS } from './thinking-config';
import { buildTsxSystemPrompt, buildVerifyPrompt } from './prompt-builder';
import { EDIT_SYSTEM_PROMPT } from './prompts/generate-prompt';
import { PLAN_SYSTEM_PROMPT } from './prompts/plan-prompt';
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts/classifier-prompt';
import { FIX_SYSTEM_PROMPT } from './prompts/fix-prompt';
import { parsePipelineMode, parseLibraries } from './mode-parser';

/**
 * The two capabilities the pipeline needs from its host process. In the
 * renderer these are IPC calls (see `rendererDeps`); in the main process the
 * job engine injects direct engine/transpiler calls, so the same pipeline code
 * runs in both without touching `window`.
 */
export interface TsxEngineDeps {
  llmGenerate: (request: LlmGenerateRequest) => Promise<LlmGenerateResponse>;
  tsxValidate: (request: TsxValidateRequest) => Promise<TsxValidateResponse>;
}

// The only window.api touchpoint in this file — everything below goes through deps.
const rendererDeps: TsxEngineDeps = {
  llmGenerate: (request) => window.api.llmGenerate(request),
  tsxValidate: (request) => window.api.tsxValidate(request),
};

function extractTsxCode(text: string): string {
  const fenceMatch = text.match(/```(?:tsx|typescript|jsx|ts)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const importIndex = text.indexOf('import ');
  if (importIndex > 0) return text.slice(importIndex).trim();
  return text.trim();
}

function formatStepOutput(text: string, thinking?: string): string {
  if (!thinking) return text;
  return `<thinking>\n${thinking}\n</thinking>\n\n${text}`;
}

function newScope(kind: string): string {
  return `${kind}:${crypto.randomUUID()}`;
}

// Transient failures worth retrying with backoff. Hard stops (cancelled,
// subscription usage limit) are excluded — waiting a few seconds won't fix them.
const TRANSIENT_ERROR_PATTERN =
  /rate limit|overloaded|econnreset|econnrefused|etimedout|socket hang up|fetch failed|network error|timed? ?out|\b(429|502|503|529)\b/i;

function isTransientError(message: string): boolean {
  if (/cancelled|usage limit/i.test(message)) return false;
  return TRANSIENT_ERROR_PATTERN.test(message);
}

const RETRY_DELAYS_MS = [2_000, 6_000];

async function llmGenerateWithRetry(
  deps: TsxEngineDeps,
  request: LlmGenerateRequest,
  debugLog: string[],
): Promise<LlmGenerateResponse> {
  let result = await deps.llmGenerate(request);
  for (const delayMs of RETRY_DELAYS_MS) {
    if (result.success || !result.error || !isTransientError(result.error)) return result;
    debugLog.push(`[Pipeline] Transient error ("${result.error}") — retrying in ${delayMs / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    result = await deps.llmGenerate(request);
  }
  return result;
}

function buildLlmRequest(
  prompt: string,
  systemPrompt: string,
  options: { providerId?: string; thinkingLevel?: string; maxTurns?: number; images?: LlmImageIpc[] },
  sessionScope?: string
) {
  const thinkingLevel = (options.thinkingLevel ?? 'off') as keyof typeof THINKING_CONFIGS;
  const config = THINKING_CONFIGS[thinkingLevel];
  return {
    prompt,
    systemPrompt,
    ...(options.providerId ? { providerId: options.providerId } : {}),
    ...(config.thinking ? { thinking: config.thinking } : {}),
    ...(config.effort ? { effort: config.effort } : {}),
    ...(options.maxTurns && options.maxTurns > 1 ? { reflectionLoops: options.maxTurns } : {}),
    ...(sessionScope ? { sessionScope } : {}),
    ...(options.images && options.images.length > 0 ? { images: options.images } : {}),
  };
}

export async function generateTsx(options: TsxGenerateOptions, deps: TsxEngineDeps = rendererDeps): Promise<GenerateResult> {
  const mode: PipelineMode = options.mode ?? '2d';
  const systemPrompt = buildTsxSystemPrompt(options.promptContext, mode);
  const sessionScope = newScope('creator:gen');
  const request = buildLlmRequest(options.prompt, systemPrompt, options, sessionScope);

  const result = await deps.llmGenerate(request);

  if (!result.success || !result.text) {
    throw new Error(result.error ?? 'Generation failed');
  }

  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;

  return {
    text: result.text,
    model: result.model ?? 'unknown',
    durationMs: result.durationMs ?? 0,
    debugLog: result.debugLog,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  };
}

export async function editTsx(options: TsxEditOptions, deps: TsxEngineDeps = rendererDeps): Promise<GenerateResult> {
  const fullPrompt = `Current code:\n\`\`\`tsx\n${options.currentCode}\n\`\`\`\n\nEdit instruction: ${options.editInstruction}`;
  const sessionScope = newScope('creator:edit');
  const request = buildLlmRequest(fullPrompt, EDIT_SYSTEM_PROMPT, options, sessionScope);

  const result = await deps.llmGenerate(request);

  if (!result.success || !result.text) {
    throw new Error(result.error ?? 'Edit failed');
  }

  const inputTokens = result.usage?.inputTokens ?? 0;
  const outputTokens = result.usage?.outputTokens ?? 0;

  return {
    text: extractTsxCode(result.text),
    model: result.model ?? 'unknown',
    durationMs: result.durationMs ?? 0,
    debugLog: result.debugLog,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  };
}

export async function generateProjectName(userPrompt: string, providerId?: string, deps: TsxEngineDeps = rendererDeps): Promise<string> {
  try {
    const result = await deps.llmGenerate({
      prompt: userPrompt,
      systemPrompt: 'Generate a short project name (2-4 words, lowercase, kebab-case) for this animation idea. Output ONLY the name, nothing else. Example: "neon-pulse-intro", "bouncing-logo", "gradient-wave".',
      ...(providerId ? { providerId } : {}),
      sessionScope: newScope('creator:project-name'),
      maxTurns: 1,
    });

    if (result.success && result.text) {
      const name = result.text.trim().toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40);
      if (name.length >= 2) return name;
    }
  } catch {
    // Fall through to fallback
  }
  return `motion-${Date.now()}`;
}

interface TranspileFixLoopArgs {
  deps: TsxEngineDeps;
  tsxCode: string;
  basePercent: number;
  weight: number;
  maxFixRetries: number;
  providerId?: string;
  thinkingLevel?: ThinkingLevel;
  sessionScope: string;
  report: (p: PipelineProgress) => void;
  debugLog: string[];
  steps: PipelineStepLog[];
  accumulateUsage: (u?: { inputTokens?: number; outputTokens?: number }) => void;
}

async function runTranspileFixLoop(args: TranspileFixLoopArgs): Promise<{
  tsxCode: string;
  transpileValid: boolean;
  fixAttempts: number;
}> {
  const { deps, basePercent, weight, maxFixRetries, providerId, thinkingLevel, sessionScope, report, debugLog, steps, accumulateUsage } = args;
  let tsxCode = args.tsxCode;
  let transpileValid = false;
  let fixAttempts = 0;

  for (let attempt = 0; attempt <= maxFixRetries; attempt++) {
    const attemptProgress = basePercent + (weight * attempt) / (maxFixRetries + 1);
    report({ step: 'transpile', stepLabel: 'Validating...', percent: Math.round(attemptProgress) });
    debugLog.push(`[Pipeline] Transpile check (attempt ${attempt + 1})...`);
    const validateResult = await deps.tsxValidate({ code: tsxCode });

    if (validateResult.success) {
      transpileValid = true;
      debugLog.push('[Pipeline] Transpile check passed');
      steps.push({ step: 'transpile', label: 'Transpile check', output: 'Passed', durationMs: 0 });
      break;
    }

    const errorMsg = validateResult.error ?? 'Unknown transpile error';
    const locationInfo = validateResult.errorLocation
      ? ` at line ${validateResult.errorLocation.line}, column ${validateResult.errorLocation.column}`
      : '';
    debugLog.push(`[Pipeline] Transpile failed: ${errorMsg}${locationInfo}`);
    steps.push({ step: 'transpile', label: `Transpile check (attempt ${attempt + 1})`, output: `Failed: ${errorMsg}${locationInfo}`, durationMs: 0 });

    if (attempt < maxFixRetries) {
      fixAttempts++;
      report({ step: 'fix', stepLabel: `Fixing (${fixAttempts}/${maxFixRetries})...`, percent: Math.round(attemptProgress + 2) });
      debugLog.push(`[Pipeline] Fixing (attempt ${fixAttempts})...`);
      const stepFixStart = Date.now();
      const fixPrompt = `## Transpile Error\n\n${errorMsg}${locationInfo}\n\n## Code\n\n\`\`\`tsx\n${tsxCode}\n\`\`\``;
      const fixRequest = buildLlmRequest(fixPrompt, FIX_SYSTEM_PROMPT, {
        providerId,
        thinkingLevel,
      }, sessionScope);

      const fixResult = await deps.llmGenerate(fixRequest);
      accumulateUsage(fixResult.usage);

      if (fixResult.success && fixResult.text) {
        tsxCode = extractTsxCode(fixResult.text);
        debugLog.push(`[Pipeline] Fix applied (${fixResult.durationMs}ms)`);
        if (fixResult.debugLog) debugLog.push(...fixResult.debugLog);
        steps.push({ step: 'fix', label: `Fix (attempt ${fixAttempts})`, output: formatStepOutput(fixResult.text, fixResult.thinking), durationMs: Date.now() - stepFixStart });
      } else {
        const fixErr = fixResult.error ?? 'unknown';
        debugLog.push(`[Pipeline] Fix step failed: ${fixErr}`);
        steps.push({ step: 'fix', label: `Fix (attempt ${fixAttempts}, failed)`, output: fixErr, durationMs: Date.now() - stepFixStart });
        break;
      }
    }
  }

  return { tsxCode, transpileValid, fixAttempts };
}

export async function generateTsxPipeline(options: TsxPipelineOptions, deps: TsxEngineDeps = rendererDeps): Promise<TsxPipelineResult> {
  const totalStart = Date.now();
  const debugLog: string[] = [];
  const steps: PipelineStepLog[] = [];
  let model = 'unknown';
  let plan: string | undefined;
  let mode: PipelineMode = options.mode ?? '2d';
  let libraries: string[] = [];
  const modeWasForced = options.mode !== undefined;
  const maxFixRetries = options.maxFixRetries ?? 3;
  const maxTurns = options.maxTurns ?? 1;
  const sessionScope = newScope('creator:pipeline');

  let inputTokens = 0;
  let outputTokens = 0;
  const accumulateUsage = (usage?: { inputTokens?: number; outputTokens?: number }) => {
    inputTokens += usage?.inputTokens ?? 0;
    outputTokens += usage?.outputTokens ?? 0;
  };

  const report = (progress: PipelineProgress) => {
    options.onProgress?.(progress);
  };

  // Progress weights
  const planWeight = options.optimize ? 15 : 5;
  const generateWeight = options.optimize ? 50 : 60;
  const verifyWeight = options.optimize ? 20 : 20;
  const transpileFixWeight = 15;

  let basePercent = 0;

  // Step 1: Plan (optimize=true) OR Classify (optimize=false)
  if (options.optimize) {
    report({ step: 'plan', stepLabel: 'Planning...', percent: 0 });
    debugLog.push('[Pipeline] Step 1: Planning...');
    const stepStart = Date.now();
    const planRequest = buildLlmRequest(options.prompt, PLAN_SYSTEM_PROMPT, {
      providerId: options.providerId,
      thinkingLevel: options.thinkingLevel,
      images: options.images,
    }, sessionScope);

    const planResult = await deps.llmGenerate(planRequest);
    accumulateUsage(planResult.usage);

    if (planResult.success && planResult.text) {
      plan = planResult.text;
      model = planResult.model ?? model;
      if (!modeWasForced) {
        mode = parsePipelineMode(plan);
      }
      libraries = parseLibraries(plan);
      debugLog.push(`[Pipeline] Plan generated (${planResult.durationMs}ms), mode=${mode}, libraries=[${libraries.join(', ')}]`);
      if (planResult.debugLog) debugLog.push(...planResult.debugLog);
      steps.push({ step: 'plan', label: `Plan (mode: ${mode})`, output: formatStepOutput(planResult.text, planResult.thinking), durationMs: Date.now() - stepStart });
    } else {
      const errMsg = planResult.error ?? 'unknown';
      debugLog.push(`[Pipeline] Plan step failed: ${errMsg}, continuing without plan (mode=${mode})`);
      steps.push({ step: 'plan', label: 'Plan (failed)', output: errMsg, durationMs: Date.now() - stepStart });
    }
    basePercent = planWeight;
  } else if (!modeWasForced) {
    // Tiny classifier call
    report({ step: 'plan', stepLabel: 'Classifying...', percent: 0 });
    debugLog.push('[Pipeline] Step 1: Classifying mode...');
    const stepStart = Date.now();
    const classifyRequest = buildLlmRequest(options.prompt, CLASSIFIER_SYSTEM_PROMPT, {
      providerId: options.providerId,
      thinkingLevel: 'off',
      maxTurns: 1,
    }, sessionScope);

    const classifyResult = await deps.llmGenerate(classifyRequest);
    accumulateUsage(classifyResult.usage);

    if (classifyResult.success && classifyResult.text) {
      mode = parsePipelineMode(classifyResult.text);
      model = classifyResult.model ?? model;
      debugLog.push(`[Pipeline] Classified as ${mode} (${classifyResult.durationMs}ms)`);
      steps.push({ step: 'plan', label: `Classify (${mode})`, output: classifyResult.text.trim(), durationMs: Date.now() - stepStart });
    } else {
      const errMsg = classifyResult.error ?? 'unknown';
      debugLog.push(`[Pipeline] Classifier failed: ${errMsg}, defaulting to mode=${mode}`);
      steps.push({ step: 'plan', label: 'Classify (failed)', output: errMsg, durationMs: Date.now() - stepStart });
    }
    basePercent = planWeight;
  }

  // Step 2: Generate (1-5 loops via maxTurns)
  const loopLabel = maxTurns > 1 ? ` (${maxTurns} loops)` : '';
  report({ step: 'generate', stepLabel: `Generating${loopLabel}...`, percent: basePercent });
  debugLog.push(`[Pipeline] Step 2: Generating TSX (mode=${mode})...`);
  const stepGenStart = Date.now();
  const generatePrompt = plan
    ? `## Animation Plan\n\n${plan}\n\n## User Request\n\n${options.prompt}`
    : options.prompt;

  const systemPrompt = buildTsxSystemPrompt(options.promptContext, mode);
  const generateRequest = buildLlmRequest(generatePrompt, systemPrompt, {
    providerId: options.providerId,
    thinkingLevel: options.thinkingLevel,
    maxTurns,
    images: options.images,
  }, sessionScope);

  const generateResult = await llmGenerateWithRetry(deps, generateRequest, debugLog);
  accumulateUsage(generateResult.usage);

  if (!generateResult.success || !generateResult.text) {
    throw new Error(generateResult.error ?? 'Generation failed');
  }

  let tsxCode = extractTsxCode(generateResult.text);
  model = generateResult.model ?? model;
  const genDuration = Date.now() - stepGenStart;
  debugLog.push(`[Pipeline] TSX generated (${generateResult.durationMs}ms)`);
  if (generateResult.debugLog) debugLog.push(...generateResult.debugLog);

  // If multi-turn, each turn is a separate debugLog entry from the handler
  if (generateResult.debugLog && generateResult.debugLog.length > 0) {
    generateResult.debugLog.forEach((turnOutput, i) => {
      const turnLabel = maxTurns > 1 ? `Generate — Loop ${i + 1}/${generateResult.debugLog!.length}` : 'Generate';
      steps.push({ step: 'generate', label: turnLabel, output: turnOutput, durationMs: Math.round(genDuration / generateResult.debugLog!.length) });
    });
  } else {
    steps.push({ step: 'generate', label: `Generate${loopLabel}`, output: formatStepOutput(generateResult.text, generateResult.thinking), durationMs: genDuration });
  }
  basePercent = planWeight + generateWeight;

  // Step 3: Verify (1 loop) — mode-specific checklist
  report({ step: 'verify', stepLabel: 'Verifying...', percent: basePercent });
  debugLog.push(`[Pipeline] Step 3: Verifying TSX (mode=${mode})...`);
  const stepVerifyStart = Date.now();
  const verifyPrompt = `Review and fix this Remotion TSX composition:\n\n\`\`\`tsx\n${tsxCode}\n\`\`\``;
  const verifyRequest = buildLlmRequest(verifyPrompt, buildVerifyPrompt(mode), {
    providerId: options.providerId,
    thinkingLevel: options.thinkingLevel,
  }, sessionScope);

  const verifyResult = await deps.llmGenerate(verifyRequest);
  accumulateUsage(verifyResult.usage);

  let verified = false;
  if (verifyResult.success && verifyResult.text) {
    verified = true;
    tsxCode = extractTsxCode(verifyResult.text);
    debugLog.push(`[Pipeline] Verification complete (${verifyResult.durationMs}ms)`);
    if (verifyResult.debugLog) debugLog.push(...verifyResult.debugLog);
    steps.push({ step: 'verify', label: `Verify (${mode})`, output: formatStepOutput(verifyResult.text, verifyResult.thinking), durationMs: Date.now() - stepVerifyStart });
  } else {
    const errMsg = verifyResult.error ?? 'unknown';
    debugLog.push(`[Pipeline] Verify step failed: ${errMsg}, using unverified code`);
    steps.push({ step: 'verify', label: 'Verify (failed)', output: errMsg, durationMs: Date.now() - stepVerifyStart });
  }
  basePercent = planWeight + generateWeight + verifyWeight;

  // Step 4: Transpile check + Fix loop
  const { tsxCode: finalCode, transpileValid, fixAttempts } = await runTranspileFixLoop({
    deps,
    tsxCode,
    basePercent,
    weight: transpileFixWeight,
    maxFixRetries,
    providerId: options.providerId,
    thinkingLevel: options.thinkingLevel,
    sessionScope,
    report,
    debugLog,
    steps,
    accumulateUsage,
  });

  report({ step: 'transpile', stepLabel: 'Complete', percent: 100 });

  return {
    text: finalCode,
    model,
    durationMs: Date.now() - totalStart,
    debugLog,
    steps,
    plan,
    mode,
    libraries,
    verified,
    transpileValid,
    fixAttempts,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  };
}

export async function editTsxPipeline(options: TsxEditPipelineOptions, deps: TsxEngineDeps = rendererDeps): Promise<TsxPipelineResult> {
  const totalStart = Date.now();
  const debugLog: string[] = [];
  const steps: PipelineStepLog[] = [];
  let model = 'unknown';
  const maxFixRetries = options.maxFixRetries ?? 3;
  const maxTurns = options.maxTurns ?? 1;
  const sessionScope = newScope('creator:edit');

  let inputTokens = 0;
  let outputTokens = 0;
  const accumulateUsage = (usage?: { inputTokens?: number; outputTokens?: number }) => {
    inputTokens += usage?.inputTokens ?? 0;
    outputTokens += usage?.outputTokens ?? 0;
  };

  const report = (progress: PipelineProgress) => {
    options.onProgress?.(progress);
  };

  const editWeight = 75;
  const transpileFixWeight = 25;

  // Step 1: Edit (1-5 loops via maxTurns)
  const loopLabel = maxTurns > 1 ? ` (${maxTurns} loops)` : '';
  report({ step: 'generate', stepLabel: `Editing${loopLabel}...`, percent: 0 });
  debugLog.push('[Pipeline] Step 1: Editing TSX...');
  const stepEditStart = Date.now();

  const fullPrompt = `Current code:\n\`\`\`tsx\n${options.currentCode}\n\`\`\`\n\nEdit instruction: ${options.editInstruction}`;
  const editRequest = buildLlmRequest(fullPrompt, EDIT_SYSTEM_PROMPT, {
    providerId: options.providerId,
    thinkingLevel: options.thinkingLevel,
    maxTurns,
    images: options.images,
  }, sessionScope);

  const editResult = await llmGenerateWithRetry(deps, editRequest, debugLog);
  accumulateUsage(editResult.usage);

  if (!editResult.success || !editResult.text) {
    throw new Error(editResult.error ?? 'Edit failed');
  }

  const tsxCode = extractTsxCode(editResult.text);
  model = editResult.model ?? model;
  const editDuration = Date.now() - stepEditStart;
  debugLog.push(`[Pipeline] Edit complete (${editResult.durationMs}ms)`);
  if (editResult.debugLog) debugLog.push(...editResult.debugLog);

  if (editResult.debugLog && editResult.debugLog.length > 0) {
    editResult.debugLog.forEach((turnOutput, i) => {
      const turnLabel = maxTurns > 1 ? `Edit — Loop ${i + 1}/${editResult.debugLog!.length}` : 'Edit';
      steps.push({ step: 'generate', label: turnLabel, output: turnOutput, durationMs: Math.round(editDuration / editResult.debugLog!.length) });
    });
  } else {
    steps.push({ step: 'generate', label: `Edit${loopLabel}`, output: formatStepOutput(editResult.text, editResult.thinking), durationMs: editDuration });
  }

  // Step 2: Transpile check + Fix loop
  const { tsxCode: finalCode, transpileValid, fixAttempts } = await runTranspileFixLoop({
    deps,
    tsxCode,
    basePercent: editWeight,
    weight: transpileFixWeight,
    maxFixRetries,
    providerId: options.providerId,
    thinkingLevel: options.thinkingLevel,
    sessionScope,
    report,
    debugLog,
    steps,
    accumulateUsage,
  });

  report({ step: 'transpile', stepLabel: 'Complete', percent: 100 });

  return {
    text: finalCode,
    model,
    durationMs: Date.now() - totalStart,
    debugLog,
    steps,
    mode: '2d',
    verified: false,
    transpileValid,
    fixAttempts,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  };
}
