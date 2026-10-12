---
status: accepted
---

# Keep every Question Type a file carries

The unified form started as Test Parrot's Question Bank Record without what Test Parrot saves about it. But Test Parrot has six Question Types, and its ADR-0033 folds the rest into them: Multiple Answer into Multiple Choice with no right answer marked, Numeric and Ordering into Short Answer. Done in the package, that folding would lose those questions for every app, including one that could play them. So the unified form keeps Test Parrot's six Question Types and adds Multiple Answer, Numeric and Ordering, which the Formats carry and Test Parrot folds away. Folding is each app's choice: Test Parrot folds as ADR-0033 says, and Class Gauntlet leaves them out.

A Question Type is added only when a Format carries questions that none of these can hold exactly.
