
# Aether

Aether is a turn-by-turn navigation application designed specifically for the MentraOS augmented reality platform. It provides clear, actionable instructions and contextual information directly into the user's field of view.

The app was developed for a conceptual HUD skiing goggles, which was developed during the Cassini Hackathon. 

The application is built as the first app for the goggles to grant efficiency and hands-free use, leveraging head gestures to seamlessly switch between detailed directions and a navigational compass view.

## Features

- Turn-by-Turn Directions: Fetches routes and instructions using the OpenRouteService API.
- Actionable Arrows Instead of verbose instructions, for glanceable comprehension.
- Head Gesture Control: Look up and down for compass view
- Clean Interface with no distractions for the athlete

## Tech Stack

- Platform: MentraOS SDK
- Language: TypeScript
- Runtime: Node.js / Bun
- Routing Service: OpenRouteService
- Networking: axios

## Usage

Once the app is launched and connected on the MentraOS glasses, the experience is driven by your movement and head position.

| Action                | Result on Glasses                                                           | Description                                                            |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Normal View/Look Down | `[ARROW] [Instruction] (Distance)`                                          | Displays the next turn instruction and distance to maneuver.           |
| Look Up               | `-- DIRECTION OF TRAVEL -- [Cardinal Direction]`                            | Shows your current GPS-calculated facing direction (N, SE, W, etc.).   |
| Moving                | Updates the current instruction and distance as you approach the next turn. | The app tracks your location and refreshes the route every 10 seconds. |
