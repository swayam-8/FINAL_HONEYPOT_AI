# Smart Throttle Implementation
**Goal**: Optimize callback frequency (reduce spam, maximize score).

## Logic Rules
The system now only sends callbacks when:
1.  **First Detection**: Always report immediately `(!session.reportSent)`.
2.  **New Intel**: Always report if `foundNewIntel` is true.
3.  **Milestone (Turn 5)**: Reports exactly at Turn 5 to secure "5+ Messages" points.
4.  **End Game (Turn 8+)**: Reports frequently after Turn 8 to capture maximum "Duration" (>60s) before the conversation ends.

## Code Changes
-   Updated `services/sessionManager.js` to include the `shouldReport` logic.
