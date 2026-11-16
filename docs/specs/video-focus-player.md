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
- **Then** stop playback, close the player, and return focus to the original Play button without moving the page. Interacting with the panel or the player leaves the dialog open.

YouTube handles keyboard input while focus is inside its embedded frame. Tab
back to the app to use Escape or activate Close video.
