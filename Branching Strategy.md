1. Production-Ready Code (main)

The main branch contains the live, production-ready version of the BrightPath application.

Rules:

Only fully tested and approved code can be merged into main.

All changes must pass CI tests before merging.

Direct commits to main are not allowed.

Every release is tagged with a version number.

The production environment runs inside Docker to ensure consistency across all systems.

Purpose: Keep the platform stable so Associates can always log in, complete homework, and take quizzes without disruption.

2. Integration Work (develop)

The develop branch is used for integrating completed features before they are released to production.

Rules:

All feature/* branches are merged into develop after code review.

Docker Compose is used to start the website and database together during testing.

CI automatically runs tests whenever changes are pushed.

Bugs are fixed here before moving to production.

Purpose: Detect issues early (such as login failures or broken quizzes) before they affect Associates.

3. New Features (feature/*)

New features are developed in separate branches created from develop.

Rules:

Naming format: feature/feature-name

Each feature is built in isolation.

Code must pass automated tests and peer review.

After approval, the feature branch is merged back into develop.

Feature branches are deleted after merging.

Examples:

feature/quiz-system

feature/progress-tracking

feature/teacher-dashboard

Purpose: Prevent unfinished or unstable code from affecting the rest of the system.

4. Emergency Fixes (hotfix/*)

Hotfix branches are used to fix urgent production problems.

Rules:

Created directly from main.

Naming format: hotfix/issue-name

Tested in the same Docker environment as production.

Merged into both main and develop after approval.

A new version tag is created after release.

Examples:

hotfix/login-failure

hotfix/quiz-save-error