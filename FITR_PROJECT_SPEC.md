# Fitr: On-Device AI Motion Verification & Hardware-Backed Fitness Staking App

## Executive Overview
**Fitr** is a mobile-native fitness **commitment** app built for the **CLOCK IN: Solana Mobile Hackathon by RadiantsDAO**. It targets the **$30,000 USDC Grand Prize** and the **$10,000 $SKR Token Integration Track**.

Fitr is **not** a move-to-earn app. You put your own $SKR on the line that you'll do today's workout: show up and you keep your stake (plus a share of what no-shows forfeited); skip and you lose it. Loss aversion, not token emissions, drives the habit.

Fitr tackles the #1 issue in Web3 fitness apps (cheating via phone shakers) by running an **on-device AI pose estimation model** (MediaPipe, GPU-accelerated in the browser/WebView) that validates real physical exercise (Push-ups, Squats, Planks). It is **cheat-resistant, backed by live challenges and on-chain rules**: joint-angle rep verification on the phone, random live challenges checked by a verification service, one Seeker = one stake, and transparent on-chain settlement. It combines this with the **Solana Mobile Stack (SMS/MWA)** and **$SKR Anti-Sloth Commitment Vaults** on **Solana mainnet** (real $SKR) to create a daily fitness habit loop.

---

## Technical Architecture & Ecosystem Stack

```
+-------------------------------------------------------------------+
|                     Android CameraX & Sensors                     |
|           (Pedometer, Accelerometer, 30 FPS Camera)               |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|              On-Device AI Computer Vision Engine                  |
|          (MediaPipe / TensorFlow Lite Pose Estimation)            |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|            Solana Mobile Stack (SMS) & MWA Adapter                 |
|             (Seeker Seed Vault Biometric Signing)                 |
+---------------------------------+---------------------------------+
                                  |
                                  v
+---------------------------------+---------------------------------+
|        $SKR Anti-Sloth Vaults & Helius Priority RPCs             |
|       (Daily Workout Stakes, Reward Boosts, Slashing Pool)        |
+-------------------------------------------------------------------+
```

### 1. On-Device AI Pose Estimation Engine
- **Model:** MediaPipe Pose / TensorFlow Lite running on the Android NPU.
- **Mechanism:** Tracks 33 3D body landmark points at 30 FPS locally on the phone.
- **Verification:** Measures joint angle flexes (e.g., elbow flex < 90° for valid push-up, knee flex < ~95° for valid squat) to count only full-range reps; partial, too-fast and bad-form reps are rejected. Cheat-resistant, not "un-cheatable": client-side checks raise the bar, and live challenges plus on-chain rules close the rest of the gap.

### 2. Android Sensor Fusion Layer
- **Sensors:** Android Pedometer (step counter), Accelerometer, and CameraX telemetry.
- **Privacy:** 100% on-device local processing; zero raw video data leaves the phone.

### 3. Solana Mobile Stack (SMS) & Mobile Wallet Adapter (MWA)
- **Role:** Direct integration with Seeker Seed Vault for hardware-backed 1-tap biometric signing.
- **Function:** Handles instant daily $SKR staking deposits, workout claims, and reward distributions.

### 4. $SKR "Anti-Sloth" Commitment Vaults ($10,000 SKR Track Target)
- **Network:** Solana mainnet, real $SKR (mint `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`, SPL Token, 6 decimals).
- **Staking Mechanics:** Each user chooses how much $SKR to commit and sets their own daily goal (exercise + reps or plank seconds, with minimums of 10 push-ups / 15 squats / 30 s plank). Stake and goal are locked on-chain together; on-chain min/max are safety rails, not a product limit.
- **Settlement (zero-sum, no emissions):**
  - **Goal Achieved:** 100% of your stake back + a pro-rata share of that day's forfeited stakes (streaks add up to +50% weight).
  - **Goal Missed:** Your stake is forfeited to that day's pool and shared among the people who showed up.
  - **Fitr fee:** 5% of forfeited stakes only; the stakes of people who show up are never touched.

### 5. Helius RPC & Priority Simulation Engine
- **Role:** Helius priority fee routing for sub-second transaction finality on Solana.
- **Simulation:** Pre-simulates vault claims on-screen before biometric signature.

---

## Mobile UI/UX & Layout Specification

- **Mobile Viewport Frame**: Android native resolution (PWA / React Native / Next.js frame).
- **Live AI Pose Feed (Camera View)**: Real-time Skeleton Overlay showing joint angles and rep counter in green.
- **Daily $SKR Commitment Deck**: Visual tracker of staked $SKR, current streak, and pool multiplier.
- **Workout Selection**: Push-ups, Squats, Planks, Step Counter.

---

## Submission Checklist (Solana Mobile Hackathon — deadline 2026-10-09 06:59 UTC)
- [ ] Android APK (Solana Mobile webshell wrapper; TWA/Bubblewrap breaks MWA)
- [ ] Solana Mobile Stack (SMS) & MWA integration
- [ ] $SKR commitment vault on mainnet (user-chosen stakes)
- [ ] Helius RPC priority fee routing
- [ ] 3-minute demo video on a real device showcasing live AI rep counting
- [ ] Pitch deck
