# Fitr: On-Device AI Motion Verification & Hardware-Backed Fitness Staking App

## Executive Overview
**Fitr** is a mobile-native fitness habit & workout verification app built for the **CLOCK IN: Solana Mobile Hackathon by RadiantsDAO**. It targets the **$30,000 USDC Grand Prize** and the **$10,000 $SKR Token Integration Track**.

Fitr solves the #1 issue in Web3 fitness apps (cheating via phone shakers) by running an **On-Device Computer Vision AI Pose Estimation Model** (30 FPS on the Android NPU) that validates real physical exercise (Push-ups, Squats, Planks). It combines Android sensor hardware with the **Solana Mobile Stack (SMS/MWA)** and native **$SKR Anti-Sloth Commitment Vaults** to create an addictive daily fitness habit loop.

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
- **Verification:** Measures joint angle flexes (e.g., elbow flex < 90° for valid push-up, knee flex < 90° for valid squat) to count un-cheatable reps.

### 2. Android Sensor Fusion Layer
- **Sensors:** Android Pedometer (step counter), Accelerometer, and CameraX telemetry.
- **Privacy:** 100% on-device local processing; zero raw video data leaves the phone.

### 3. Solana Mobile Stack (SMS) & Mobile Wallet Adapter (MWA)
- **Role:** Direct integration with Seeker Seed Vault for hardware-backed 1-tap biometric signing.
- **Function:** Handles instant daily $SKR staking deposits, workout claims, and reward distributions.

### 4. $SKR "Anti-Sloth" Commitment Vaults ($10,000 SKR Track Target)
- **Staking Mechanics:** Users stake 100 $SKR into a daily workout vault.
- **Reward Engine:** 
  - **Goal Achieved:** 100% $SKR returned + bonus $SKR yield from daily pool.
  - **Goal Missed:** Staked $SKR slashed into the community reward pool.

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

## Submission Checklist (Solana Mobile Hackathon)
- [x] Android Native APK compilation target
- [x] Solana Mobile Stack (SMS) & MWA integration
- [x] $SKR token staking & reward utility
- [x] Helius RPC priority fee routing
- [x] 3-minute demo video script showcasing live AI rep counting
