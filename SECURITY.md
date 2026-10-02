# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://github.com/hassancs91/VidTSX-STUDIO/security/advisories/new)
for this repository. Do not open a public issue for anything that could put
users' keys, files or machines at risk.

You will get an acknowledgement within a few days. Once a fix ships, the
report is credited in the release notes unless you ask otherwise.

## What is in scope

VidTSX Studio is a local-first desktop app. The things worth reporting:

- Provider API keys leaving the machine anywhere other than the provider they
  belong to, or reaching the renderer process at all.
- Code from a project, template, agent, flow or pack (`.vidtsx*` files)
  running outside the sandbox it is meant to run in, or escaping the
  extraction directory when a package is imported.
- The content-safety gate being bypassed in a release build.
- The auto-updater accepting an installer that did not come from this
  repository's releases.
- Any network request the app makes that is not listed under
  "Launch-time network requests" in the README.

## What is out of scope

- Issues in the third-party models, providers or binaries the app downloads
  on first use (report those upstream).
- Anything that needs the user to build the app from source with a dev
  feature flag set.

## Supported versions

Only the latest release receives fixes. The app updates itself; if you have
turned updates off, update by hand before reporting.
