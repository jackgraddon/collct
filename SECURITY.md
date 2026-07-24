# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Collct, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, email `hello@jackgraddon.com` with:

- A description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested fixes (optional)

You should receive an acknowledgement within 48 hours. We'll work with you to understand and address the issue before any public disclosure.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Scope

Collct is a self-hosted photo sharing app. Security issues that are **in scope** include:

- Authentication bypass
- Privilege escalation (accessing other users' photos/groups)
- Session hijacking
- Remote code execution
- SQL injection or other injection attacks
- Cross-site scripting (XSS) that affects other users
- Data exposure of private photos or user data

Security issues that are **out of scope**:

- Denial of service (DoS)
- Issues in third-party dependencies (report these upstream)
- Issues that require physical access to the server

## Disclosure Policy

We follow coordinated disclosure. Please give us 90 days to address the vulnerability before public disclosure. We'll keep you updated on our progress and credit you in the fix (unless you prefer to remain anonymous).
