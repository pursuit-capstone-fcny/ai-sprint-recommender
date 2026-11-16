# Spec: Larger embedded video player

- **Status:** in review

## Acceptance criteria

### AC-1. Open the player

- **Given** a learner is browsing starter, recommended, or fallback videos
- **When** they select a card's Play button
- **Then** open a centered 16:9 YouTube player, sized for desktop or mobile, with focus on Close video. Keep the results in place and record the existing embed click once.

### AC-2. Dismiss the player

- **Given** the player is open
- **When** the learner selects Close video, clicks or taps the backdrop, or presses Escape while focus is in the app
- **Then** pause playback, close the player, and return focus to the original Play button without moving the page. Interacting with the panel or the player leaves the dialog open.

YouTube handles keyboard input while focus is inside its embedded frame. Tab
back to the app to use Escape or activate Close video.

### AC-3. Resume a minimized video

- **Given** a video has loaded its playback controls and the learner closes the dialog
- **When** the learner selects Play for the same video again without opening a different video or reloading the page
- **Then** reopen the existing player and resume from its paused position. If playback controls have not connected, remove the embed on close to prevent background playback.

### AC-4. Show the paused time on the card

- **Given** a learner minimizes a video with a resumable playback position
- **When** they return to the results
- **Then** show the paused time on the video's thumbnail and include it in the Play button's accessible name. When YouTube reports its duration, show a thin bar proportional to the playback position and include the percentage in the button's accessible name. A seek changes the position. Clear both indicators when the learner resumes playback or opens a different video. Keep this state in the page and out of analytics.
