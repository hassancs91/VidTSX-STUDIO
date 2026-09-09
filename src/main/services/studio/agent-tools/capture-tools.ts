// Webpage captures for shots: capture_webpage (one still) and
// capture_scripted (typed steps, several stills of one walkthrough).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { captureWebpage } from '../../library/capture';
import {
  captureScripted,
  SCRIPT_MAX_CAPTURES,
  SCRIPT_MAX_STEPS,
  type CaptureScriptStep,
} from '../../library/capture-script';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import { emitTool, errorText, text, type StudioTool, type StudioToolContext } from './types';

export function buildCaptureTools(ctx: StudioToolContext): StudioTool[] {
  const { signal } = ctx;

  const captureWebpageTool = tool(
    'capture_webpage',
    'Screenshot a webpage into the asset library (origin: captured, description: page title + URL) — screenshot material for shots. Hidden by default; pass visible=true for login-walled pages (the window opens for the user to log in and navigate, then THEY click "Capture now" — can take minutes). Returns a "library:<path>" ref for generate_tsx_shot assetRefs.',
    {
      url: z.string().describe('The http(s) page to capture'),
      viewport: z.enum(['landscape', 'portrait', 'desktop']).optional().describe('landscape 1280×720 (default), portrait 390×844, desktop 1440×900 — CSS pixels, rendered at 2×'),
      fullPage: z.boolean().optional().describe('Capture the full page height (capped ~8000 px) instead of one viewport. Use this for stills that will scroll inside the kit BrowserWindow — a full-height still gives the fake browser real scroll range (divide the reported height by 2 for CSS px when writing scroll targets)'),
      visible: z.boolean().optional().describe('Open the window visibly and wait for the user to log in / navigate and click Capture'),
    },
    async (args) => {
      emitTool(ctx, 'capture_webpage', `${args.url}${args.visible ? ' (visible)' : ''}`);
      try {
        const result = await captureWebpage({
          url: args.url,
          ...(args.viewport ? { viewport: args.viewport } : {}),
          ...(args.fullPage !== undefined ? { fullPage: args.fullPage } : {}),
          ...(args.visible !== undefined ? { visible: args.visible } : {}),
          signal,
        });
        return text(
          `Captured "${result.title || result.url}" → ${LIBRARY_REF_PREFIX}${result.relPath} (${result.width}×${result.height}). ` +
            `To use it inside a shot, pass it in generate_tsx_shot assetRefs, e.g. { "screenshot1": "${LIBRARY_REF_PREFIX}${result.relPath}" }.`,
        );
      } catch (err) {
        return text(`Webpage capture failed: ${errorText(err)}`, true);
      }
    },
  );

  // Scripted capture (ASSET_LIBRARY_DESIGN L6b / Q4b): typed steps, no
  // agent-authored code — selectors are data, text becomes input events.
  const captureStepSchema = z.discriminatedUnion('op', [
    z.object({ op: z.literal('navigate'), url: z.string().describe('http(s) page to load') }),
    z.object({
      op: z.literal('wait'),
      ms: z.number().int().min(50).max(10_000).optional().describe('fixed delay (default 500)'),
      selector: z.string().optional().describe('instead: wait until this CSS selector is visible (up to 10 s)'),
    }),
    z.object({
      op: z.literal('scroll'),
      to: z.union([z.number(), z.string()]).describe("y in CSS px, 'bottom', or a CSS selector to scroll to"),
    }),
    z.object({
      op: z.literal('type'),
      selector: z.string().describe('CSS selector of the field (clicked to focus first)'),
      text: z.string().max(500).describe('typed as real key events; \\n presses Enter'),
    }),
    z.object({ op: z.literal('click'), selector: z.string().describe('CSS selector; clicked at its center with real mouse events') }),
    z.object({
      op: z.literal('capture'),
      label: z.string().min(1).describe("what this state shows, e.g. 'pricing section, annual toggle on' — becomes the searchable description"),
      fullPage: z.boolean().optional().describe('grow to full page height (capped ~8000 px) for this still, then restore'),
    }),
  ]);

  const captureScriptedTool = tool(
    'capture_scripted',
    `Drive a webpage through several REAL states and capture a still of each — menus opened, forms filled, different scroll depths of one walkthrough. Same hardened hidden window, filing, and "library:<path>" refs as capture_webpage (which stays the right tool for a single still). The kit still renders the MOTION (typing, cursors, scrolling); scripted stills only supply real content states. Up to ${SCRIPT_MAX_STEPS} steps / ${SCRIPT_MAX_CAPTURES} captures, ~10 s per step, 120 s per script, one script at a time. On a failed step you get the stills captured so far plus which step failed — retry with a fixed script or use what landed. Hidden window only: login-walled pages need the user's visible capture_webpage flow instead.`,
    {
      url: z.string().describe('The http(s) page the script starts on'),
      viewport: z.enum(['landscape', 'portrait', 'desktop']).optional().describe('landscape 1280×720 (default), portrait 390×844, desktop 1440×900 — CSS pixels, rendered at 2×'),
      steps: z.array(captureStepSchema).min(1).max(SCRIPT_MAX_STEPS).describe('Run in order; include a capture step for every state worth keeping'),
    },
    async (args) => {
      emitTool(ctx, 'capture_scripted', `${args.url} (${args.steps.length} steps)`);
      try {
        const result = await captureScripted({
          url: args.url,
          ...(args.viewport ? { viewport: args.viewport } : {}),
          steps: args.steps as CaptureScriptStep[],
          signal,
        });
        const lines = result.stills.map(
          (s) => `- "${s.label}" → ${LIBRARY_REF_PREFIX}${s.relPath} (${s.width}×${s.height})`,
        );
        const failure = result.failedStep
          ? `\nStep ${result.failedStep.index + 1} (${result.failedStep.op}) FAILED: ${result.failedStep.error}. The stills above were captured before the failure and are usable.`
          : '';
        return text(
          `Scripted capture ${result.failedStep ? 'stopped early' : 'complete'}: ${result.stills.length} still(s).\n${lines.join('\n')}${failure}\n` +
            `Use them in generate_tsx_shot assetRefs, e.g. { "state1": "${LIBRARY_REF_PREFIX}${result.stills[0]?.relPath ?? '…'}" }.`,
          result.stills.length === 0,
        );
      } catch (err) {
        return text(`Scripted capture failed: ${errorText(err)}`, true);
      }
    },
  );

  return [captureWebpageTool, captureScriptedTool];
}
