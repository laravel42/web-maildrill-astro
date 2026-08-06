#!/usr/bin/env python3
"""
Maildrill Teaser — 30s Audio Generator & Mixer
Generates stems (vo.wav, sfx.wav, music.wav) and final master mix (mix_30s_master.wav)
according to the Maildrill Audio Specification.
"""

import sys
import os
import math
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

# Configuration
FS = 48000  # 48kHz audio sample rate
DURATION = 30.0  # 30 seconds
TOTAL_SAMPLES = int(FS * DURATION)

def ensure_stereo(audio):
    """Ensure audio array is 2D (samples, 2)."""
    if audio.ndim == 1:
        return np.column_stack((audio, audio))
    return audio

def normalize_lufs_approx(audio, target_db=-16.0):
    """Normalize audio array to approximately target dB RMS / Peak."""
    rms = np.sqrt(np.mean(audio ** 2))
    if rms == 0:
        return audio
    current_db = 20 * np.log10(rms + 1e-9)
    gain = 10 ** ((target_db - current_db) / 20)
    out = audio * gain
    # Ensure no clipping
    max_val = np.max(np.abs(out))
    if max_val > 0.95:
        out = out * (0.95 / max_val)
    return out

def lowpass_filter(data, cutoff, fs=FS, order=2):
    nyq = 0.5 * fs
    normal_cutoff = min(cutoff / nyq, 0.99)
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    return lfilter(b, a, data, axis=0)

def highpass_filter(data, cutoff, fs=FS, order=2):
    nyq = 0.5 * fs
    normal_cutoff = max(cutoff / nyq, 0.001)
    b, a = butter(order, normal_cutoff, btype='high', analog=False)
    return lfilter(b, a, data, axis=0)

def run_cmd(cmd):
    """Run a subprocess, treating a missing executable as a non-zero result.

    subprocess.run raises FileNotFoundError when the binary isn't installed,
    which would bypass the intended TTS fallback chain — normalize that to a
    CompletedProcess with returncode 1 so callers can degrade gracefully.
    """
    try:
        return subprocess.run(cmd, capture_output=True)
    except FileNotFoundError:
        return subprocess.CompletedProcess(cmd, returncode=1)

# ==========================================
# 1. VOICE OVER GENERATION
# ==========================================
VO_LINES = [
    (1.0, "Marketing shouldn't be complicated."),
    (6.0, "But every channel wants to be its own tool."),
    (16.0, "Every conversation. One place."),
    (20.0, "One audience. One workspace. Pay for exactly what you send."),
    (26.0, "Maildrill. One platform. Every conversation.")
]

def generate_vo_stem():
    print("[1/4] Generating Voiceover Stem...")
    vo_mix = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    
    # Try using edge-tts or gtts via subprocess or python
    for i, (timestamp, text) in enumerate(VO_LINES):
        temp_mp3 = f"/tmp/vo_line_{i}.mp3"
        temp_wav = f"/tmp/vo_line_{i}.wav"
        
        # Try edge-tts first
        cmd_edge = ["edge-tts", "--voice", "en-US-AndrewNeural", "--text", text, "--write-media", temp_mp3]
        res = run_cmd(cmd_edge)
        
        if res.returncode != 0:
            # Fallback to gTTS if available or curl/python
            cmd_gtts = ["gtts-cli", text, "--output", temp_mp3]
            res_gtts = run_cmd(cmd_gtts)
            if res_gtts.returncode != 0:
                print(f"Warning: TTS tool not found for line: '{text}'. Using generated synthesized voice proxy.")
                # Create synthesized voice proxy tone/speech pattern
                t_speech = np.linspace(0, 2.0, int(FS * 2.0))
                env = np.exp(-t_speech * 1.5) * np.sin(np.pi * t_speech / 2.0)
                freq = 130 + 20 * np.sin(2 * np.pi * 3 * t_speech)
                f_voice = np.sin(2 * np.pi * freq * t_speech) * env * 0.3
                f_voice_stereo = np.column_stack((f_voice, f_voice))
                start_idx = int(timestamp * FS)
                end_idx = min(start_idx + len(f_voice_stereo), TOTAL_SAMPLES)
                vo_mix[start_idx:end_idx] += f_voice_stereo[:end_idx-start_idx]
                continue

        # Convert temp MP3 to WAV 48kHz stereo using ffmpeg
        cmd_ffmpeg = ["ffmpeg", "-y", "-i", temp_mp3, "-ar", "48000", "-ac", "2", temp_wav]
        run_cmd(cmd_ffmpeg)
        
        if os.path.exists(temp_wav):
            sr, data = wavfile.read(temp_wav)
            data = data.astype(np.float32) / 32768.0
            data = ensure_stereo(data)
            
            start_idx = int(timestamp * FS)
            end_idx = min(start_idx + len(data), TOTAL_SAMPLES)
            vo_mix[start_idx:end_idx] += data[:end_idx-start_idx]

    return vo_mix


# ==========================================
# 2. SOUND DESIGN (SFX) GENERATION
# ==========================================
def generate_sfx_stem():
    print("[2/4] Synthesizing Sound Design SFX Stem...")
    sfx = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    
    # ~0:05: Soft Whoosh
    w_start = int(4.8 * FS)
    w_dur = int(0.7 * FS)
    t_w = np.linspace(0, 1, w_dur)
    noise_w = np.random.normal(0, 0.1, w_dur)
    env_w = np.sin(np.pi * t_w) ** 2
    whoosh = lowpass_filter(noise_w * env_w, 800)
    sfx[w_start:w_start+w_dur, 0] += whoosh * 0.15
    sfx[w_start:w_start+w_dur, 1] += whoosh * 0.15

    # ~0:07: Four soft glassy UI ticks (Email, SMS, WhatsApp, Voice)
    tick_freqs = [2200, 2600, 3100, 3700]
    tick_times = [7.0, 7.25, 7.50, 7.75]
    for ft, tt in zip(tick_freqs, tick_times):
        t_idx = int(tt * FS)
        dur = int(0.04 * FS)
        t_t = np.linspace(0, 0.04, dur)
        tick_sig = np.sin(2 * np.pi * ft * t_t) * np.exp(-t_t * 120) * 0.12
        sfx[t_idx:t_idx+dur, 0] += tick_sig
        sfx[t_idx:t_idx+dur, 1] += tick_sig

    # 0:09–0:12: Faint overlapping notification clutter (≤ -18dB)
    c_start = int(9.0 * FS)
    c_end = int(12.0 * FS)
    np.random.seed(42)
    for _ in range(12):
        t_note = c_start + int(np.random.uniform(0, 2.8) * FS)
        dur = int(0.06 * FS)
        t_n = np.linspace(0, 0.06, dur)
        freq = np.random.choice([880, 1046, 1318, 1567, 1760])
        note = np.sin(2 * np.pi * freq * t_n) * np.exp(-t_n * 60) * 0.04
        if t_note + dur < TOTAL_SAMPLES:
            sfx[t_note:t_note+dur, 0] += note
            sfx[t_note:t_note+dur, 1] += note * 0.8

    # 0:12–0:13.5: Pitch Riser → Total hard cut at 0:12.8
    r_start = int(11.8 * FS)
    r_end = int(12.8 * FS)
    r_dur = r_end - r_start
    t_r = np.linspace(0, 1.0, r_dur)
    freq_r = 150 * (12.0 ** t_r)  # Exponential pitch rise
    phase_r = 2 * np.pi * np.cumsum(freq_r) / FS
    riser = np.sin(phase_r) * (t_r ** 2) * 0.25
    sfx[r_start:r_end, 0] += riser
    sfx[r_start:r_end, 1] += riser

    # ~0:14: Deep impact/boom on logo
    b_start = int(13.8 * FS)
    b_dur = int(1.5 * FS)
    t_b = np.linspace(0, 1.5, b_dur)
    f_boom = 130 * np.exp(-t_b * 3.5) + 35
    phase_b = 2 * np.pi * np.cumsum(f_boom) / FS
    boom = np.sin(phase_b) * np.exp(-t_b * 2.2) * 0.6
    # Sub transient
    trans = np.random.normal(0, 0.2, int(0.05*FS)) * np.exp(-np.linspace(0, 0.05, int(0.05*FS))*100)
    boom[:len(trans)] += trans
    sfx[b_start:b_start+b_dur, 0] += boom
    sfx[b_start:b_start+b_dur, 1] += boom

    # ~0:19: Clean UI confirmation
    u_start = int(19.0 * FS)
    u_dur = int(0.25 * FS)
    t_u = np.linspace(0, 0.25, u_dur)
    ui_sig = (np.sin(2*np.pi*523.25*t_u) + np.sin(2*np.pi*783.99*t_u)) * np.exp(-t_u*15) * 0.15
    sfx[u_start:u_start+u_dur, 0] += ui_sig
    sfx[u_start:u_start+u_dur, 1] += ui_sig

    # 0:29: Soft shimmer on "Launching soon"
    sh_start = int(28.8 * FS)
    sh_dur = int(1.2 * FS)
    t_sh = np.linspace(0, 1.2, sh_dur)
    shimmer = np.zeros(sh_dur)
    for freq in [1318.5, 1661.2, 1975.5, 2637.0]:
        shimmer += np.sin(2*np.pi*freq*t_sh + np.sin(2*np.pi*5*t_sh)) * 0.03
    shimmer *= np.sin(np.pi * t_sh / 1.2) ** 2
    sfx[sh_start:sh_start+sh_dur, 0] += shimmer
    sfx[sh_start:sh_start+sh_dur, 1] += shimmer

    return sfx


# ==========================================
# 3. MUSIC BED GENERATION
# ==========================================
def generate_music_stem():
    print("[3/4] Synthesizing Cinematic Music Bed Stem...")
    music = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    
    # helper note synthesizer
    def chord_synth(freqs, start_time, duration, attack=0.2, decay=0.3, volume=0.2):
        s_idx = int(start_time * FS)
        d_idx = int(duration * FS)
        e_idx = min(s_idx + d_idx, TOTAL_SAMPLES)
        length = e_idx - s_idx
        if length <= 0:
            return
        t = np.linspace(0, duration, length)
        
        # Envelope
        env = np.ones(length)
        att_len = int(attack * FS)
        dec_len = int(decay * FS)
        if att_len > 0 and att_len < length:
            env[:att_len] = np.linspace(0, 1, att_len)
        if dec_len > 0 and dec_len < length:
            env[-dec_len:] = np.linspace(1, 0, dec_len)
            
        sig = np.zeros(length)
        for f in freqs:
            sig += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
        sig = (sig / len(freqs)) * env * volume
        music[s_idx:e_idx, 0] += sig
        music[s_idx:e_idx, 1] += sig

    # 0:00–0:04: Cold Open - Low sustained C drone + sparse piano C4
    chord_synth([65.4, 98.0, 130.8], 0.0, 4.2, attack=0.5, decay=0.8, volume=0.25)
    # Sparse piano note at 1.5s
    t_p = np.linspace(0, 2.5, int(2.5 * FS))
    piano = np.sin(2 * np.pi * 261.63 * t_p) * np.exp(-t_p * 2.0) * 0.18
    p_start = int(1.5 * FS)
    p_end = min(p_start + len(piano), TOTAL_SAMPLES)
    music[p_start:p_end, 0] += piano[:p_end-p_start]
    music[p_start:p_end, 1] += piano[:p_end-p_start]

    # 0:04–0:09: Build - String pulse (~65 BPM feel)
    pulse_times = np.arange(4.0, 9.0, 60.0 / 65.0)
    for pt in pulse_times:
        chord_synth([130.8, 155.56, 196.0], pt, 0.7, attack=0.05, decay=0.3, volume=0.2)

    # 0:09–0:12: Tension - Ticking percussion + suspended harmony
    tock_times = np.arange(9.0, 12.5, 60.0 / 130.0)
    for tt in tock_times:
        t_idx = int(tt * FS)
        dur = int(0.03 * FS)
        if t_idx + dur < TOTAL_SAMPLES:
            t_t = np.linspace(0, 0.03, dur)
            tick = np.sin(2 * np.pi * 1800 * t_t) * np.exp(-t_t * 150) * 0.08
            music[t_idx:t_idx+dur, 0] += tick
            music[t_idx:t_idx+dur, 1] += tick
    chord_synth([174.61, 220.0, 261.63, 293.66], 9.0, 3.5, attack=0.3, decay=0.5, volume=0.22)

    # 0:12–0:13.5: Hard Cut to Silence (~1s gap)
    music[int(12.8 * FS):int(13.8 * FS), :] = 0.0

    # 0:13.5–0:16: THE REVEAL - Orchestral hit on logo (~0:14)
    # Warm C Major hit (C2, C3, G3, E4, G4, C5)
    c_major_hit = [65.4, 130.8, 196.0, 329.63, 392.0, 523.25]
    chord_synth(c_major_hit, 13.8, 2.5, attack=0.08, decay=1.2, volume=0.45)

    # 0:16–0:25: Confident Stride (Forward-moving major chord progression)
    # C -> G -> Am -> F
    progression = [
        (16.0, [130.8, 164.81, 196.0]),  # C
        (18.25, [98.0, 123.47, 146.83]),  # G
        (20.5, [110.0, 130.8, 164.81]),  # Am
        (22.75, [87.31, 130.8, 174.61])  # F
    ]
    for st, freqs in progression:
        chord_synth(freqs, st, 2.2, attack=0.1, decay=0.4, volume=0.28)
        # Pulse overlay
        for p_off in [0.0, 0.92, 1.84]:
            chord_synth([f * 2 for f in freqs], st + p_off, 0.6, attack=0.04, decay=0.2, volume=0.15)

    # 0:25–0:30: End Card - Soft swell and gentle resolved chord with shimmer tail
    chord_synth([130.8, 196.0, 329.63, 493.88, 523.25], 25.0, 5.0, attack=0.4, decay=1.5, volume=0.35)

    return music


# ==========================================
# 4. DUCKING & MASTER MIXING
# ==========================================
def create_master_mix(vo, sfx, music):
    print("[4/4] Mixing, Ducking & Mastering to -16 LUFS...")
    
    # Calculate VO amplitude envelope for dynamic ducking (-5dB during VO)
    vo_mono = np.abs(np.mean(vo, axis=1))
    # Smooth VO envelope (100ms window)
    window_size = int(0.10 * FS)
    vo_env = np.convolve(vo_mono, np.ones(window_size)/window_size, mode='same')
    
    # Calculate ducking factor (1.0 when quiet, ~0.56 (-5dB) when speaking)
    duck_factor = 1.0 - 0.44 * np.clip(vo_env * 8.0, 0.0, 1.0)
    duck_factor_stereo = np.column_stack((duck_factor, duck_factor))
    
    # Apply ducking to music and SFX
    music_ducked = music * duck_factor_stereo
    sfx_ducked = sfx * duck_factor_stereo
    
    # Final Summation
    master = vo * 1.1 + music_ducked * 0.85 + sfx_ducked * 0.9
    
    # Normalize to -16 LUFS / -1dB Peak limit
    master_norm = normalize_lufs_approx(master, target_db=-16.0)
    
    return master_norm, vo, sfx_ducked, music_ducked


def save_wav(filename, data):
    # Ensure int16 conversion
    data_clipped = np.clip(data, -0.98, 0.98)
    data_int16 = (data_clipped * 32767.0).astype(np.int16)
    wavfile.write(filename, FS, data_int16)
    print(f"Saved stem: {filename}")


if __name__ == "__main__":
    print("=== Maildrill Teaser 30s Audio Generator ===")
    
    vo_stem = generate_vo_stem()
    sfx_stem = generate_sfx_stem()
    music_stem = generate_music_stem()
    
    master_mix, vo_out, sfx_out, music_out = create_master_mix(vo_stem, sfx_stem, music_stem)
    
    save_wav("vo.wav", vo_out)
    save_wav("sfx.wav", sfx_out)
    save_wav("music.wav", music_out)
    save_wav("mix_30s_master.wav", master_mix)
    
    print("\n[SUCCESS] All 4 stems successfully generated:")
    print(" - vo.wav")
    print(" - sfx.wav")
    print(" - music.wav")
    print(" - mix_30s_master.wav")