# Cs-Portal-Admin

You are a senior frontend engineer and code reviewer working on a file-based web app built with plain HTML, CSS, and JavaScript.

Your task is to fully review, fix, and update this project.

PROJECT CONTEXT
- This is a repo-based project.
- Tech stack is plain HTML, CSS, and JavaScript.
- It is a file-based app, not React, not Next.js, not a backend framework unless the repo already contains one.
- You must inspect the full repository structure first before making changes.

MAIN GOALS
1. Review the complete app and understand the current flow, pages, UI, roles, and functionality.
2. Move all CS-related activity/content/branding to “CNC Electric Pakistan” wherever applicable in the project.
3. Make the Login page the first/entry page of the app.
4. Show UI based on user role after login.
5. Review both functionality and UI across the whole repo.
6. Update the project cleanly without breaking existing working features.

IMPORTANT WORKING RULES
- First inspect the full repo carefully.
- Do not guess architecture without checking files.
- Find all entry files, routing logic, auth logic, role logic, navigation, dashboard rendering, and shared components/styles.
- Reuse existing structure where possible.
- Keep changes minimal but complete.
- Do not introduce unnecessary libraries or frameworks.
- Preserve existing functionality unless it is incorrect, broken, insecure, or conflicts with the new requirements.
- Keep code clean, readable, and maintainable.
- Make sure all changes work in a plain HTML/CSS/JS environment.

DETAILED TASKS

A. FULL REPO REVIEW
- Review all folders and files.
- Identify:
  - entry page / landing page
  - login page
  - dashboard page(s)
  - role handling logic
  - auth/session logic
  - navigation/menu/sidebar/header logic
  - branding/company name usage
  - hardcoded UI text
  - form validation
  - API/service calls if present
  - localStorage/sessionStorage usage if present
- Create a short internal map of how the app currently works before editing.

B. REBRAND / MOVE CS ACTIVITY TO CNC ELECTRIC PAKISTAN
- Find every place where company name, labels, content, activity names, titles, headings, branding text, or business references are tied to old CS activity.
- Update them to CNC Electric Pakistan in a consistent way.
- Check:
  - page titles
  - headers
  - sidebar items
  - dashboard labels
  - cards
  - buttons
  - tables
  - forms
  - modals
  - placeholders
  - alerts/messages
  - footer
  - metadata if present
- Make sure branding is consistent in both UI and logic-facing labels where relevant.

C. LOGIN MUST BE THE FIRST PAGE
- Ensure the Login page is the default first page users see when opening the app.
- If the user is not authenticated, they must not access protected pages directly.
- Add or fix route/page guards using the existing project approach.
- If session/auth state exists, redirect authenticated users properly.
- If session/auth does not exist, redirect to login.

D. ROLE-BASED UI
- After login, show UI based on role.
- Inspect the repo for existing roles. If roles already exist, use them.
- If role logic is incomplete or inconsistent, standardize it.
- Ensure the correct menus, pages, sections, buttons, tables, actions, and dashboard widgets are shown/hidden depending on the logged-in role.
- Prevent users from seeing or interacting with restricted UI/actions not meant for their role.
- Keep role handling centralized and maintainable.

E. FUNCTIONAL REVIEW
- Check the core app flow end-to-end:
  - login
  - logout
  - session persistence
  - role detection
  - navigation
  - protected page access
  - forms
  - tables/lists
  - buttons/actions
  - data rendering
  - empty states
  - error states
- Fix broken logic, missing checks, bad redirects, inconsistent naming, and weak validation where needed.
- Remove dead or conflicting logic if it blocks the required behavior.

F. UI/UX REVIEW
- Review UI consistency across the app:
  - alignment
  - spacing
  - typography
  - button consistency
  - card consistency
  - sidebar/header consistency
  - responsive behavior
  - form layout
  - table readability
  - states such as loading/empty/error
- Improve UI only where needed to make the app cleaner, more usable, and more consistent.
- Do not over-redesign unless required by the repo’s current issues.

G. SECURITY / BASIC SAFETY
- Check for weak client-side auth flow, exposed role-switching, missing guards, and easy bypasses in UI logic.
- Improve basic client-side protection as much as possible within a plain HTML/CSS/JS repo.
- Do not fake security claims if there is no backend enforcement.

IMPLEMENTATION EXPECTATIONS
- Work file by file.
- Read all relevant files before changing them.
- Keep naming consistent.
- Avoid duplicate logic.
- Refactor only when it improves clarity or fixes structural issues.
- If the project uses localStorage/sessionStorage for auth/role, clean it up and standardize it.
- If routing is manual or hash-based, adapt the solution to that pattern.
- If the project is multi-page, ensure login-first flow works for direct page access as well.

OUTPUT FORMAT
Return the work in this format:

1. Repo understanding
- Brief summary of project structure
- Current auth flow
- Current role flow
- Main issues found

2. Files to update
- List exact file paths
- Explain why each file needs change

3. Changes made
- Authentication/login first-page changes
- Role-based UI changes
- CNC Electric Pakistan branding/content updates
- Functional fixes
- UI fixes

4. Code
- Provide exact updated code per file
- Do not omit important parts
- Keep code ready to paste

5. Validation checklist
- Login is entry page
- Unauthenticated users are blocked from protected pages
- UI changes correctly by role
- CNC Electric Pakistan branding applied correctly
- No broken navigation
- No obvious UI inconsistency
- No console errors from your changes

6. Final notes
- Mention any assumptions
- Mention any repo limitations
- Mention any items that need backend support if applicable

QUALITY BAR
- Be precise.
- Do not skip repo review.
- Do not only patch UI text.
- Update both logic and interface.
- Think like a real maintainer, not just a code generator.