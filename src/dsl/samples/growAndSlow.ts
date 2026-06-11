import type { GameSpec } from "../types";

/**
 * The canonical GamePilot demo, hand-written to exercise every part of the v0
 * runtime: control, behaviour, collisions, prop mutation, spawning, scoring,
 * and a win condition.
 *
 * Idea: "A blob that grows by eating food but moves slower as it grows.
 *        Red enemies chase it; touching one ends the game."
 */
export const growAndSlow: GameSpec = {
  meta: {
    title: "Grow & Slow",
    idea: "A blob that grows by eating food but moves slower as it grows; red enemies chase it.",
  },
  world: {
    width: 800,
    height: 600,
    background: "#0b0b12",
    edges: "wall",
  },
  entities: [
    {
      id: "player",
      kind: "player",
      shape: "circle",
      color: "#4aa3ff",
      size: 14,
      control: "follow-pointer",
      spawn: { x: 400, y: 300, count: 1 },
      props: { speed: 260 },
    },
    {
      id: "food",
      kind: "food",
      shape: "dot",
      color: "#ffd23f",
      size: 5,
      spawn: { random: true, count: 18, maintain: 18 },
    },
    {
      id: "enemy",
      kind: "enemy",
      shape: "square",
      color: "#ff4d4d",
      size: 13,
      behavior: "chase:player",
      spawn: { random: true, count: 3 },
      props: { speed: 90 },
    },
  ],
  rules: [
    {
      on: "collision",
      between: ["player", "food"],
      effects: [
        { op: "add", target: "self.size", value: 1.5 },
        { op: "add", target: "self.speed", value: -6 },
        { op: "destroy", target: "other" },
        { op: "score", value: 1 },
      ],
    },
    {
      on: "collision",
      between: ["player", "enemy"],
      effects: [{ op: "gameover" }],
    },
    // Difficulty ramp: a new enemy joins every 12 seconds.
    {
      on: "interval",
      every: 12,
      effects: [{ op: "spawn", target: "enemy" }],
    },
  ],
  win: { when: "score >= 20" },
};
