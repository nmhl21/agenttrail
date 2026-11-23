#!/usr/bin/env python3
"""AgentTrail demo video slides — 1280x720 dark cards, PIL (adapted from QuizForge)."""
from PIL import Image, ImageDraw, ImageFont
import os

D = "/home/hatch/workspace/agentid/agenttrail/video"
BG = (14, 15, 19)
PANEL = (23, 25, 34)
ACCENT = (240, 185, 11)   # Binance yellow
WHITE = (242, 243, 245)
MUTED = (154, 163, 178)
GOLD = (255, 209, 102)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(p, s):
    return ImageFont.truetype(p, s)

def base():
    img = Image.new("RGB", (1280, 720), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1280, 6], fill=ACCENT)
    d.rectangle([0, 714, 1280, 720], fill=ACCENT)
    return img, d

def kicker(d, text, y=64):
    d.text((80, y), text, font=font(FB, 26), fill=ACCENT)

def headline(d, text, y=110, size=54):
    d.text((80, y), text, font=font(FB, size), fill=WHITE)

def panel(d, box, fill=PANEL):
    d.rounded_rectangle(box, radius=16, fill=fill)

def save(img, name):
    p = os.path.join(D, name)
    img.save(p)
    print("wrote", p)

# ---- 1. Title ----
img, d = base()
d.text((80, 170), "AGENTTRAIL", font=font(FB, 110), fill=WHITE)
d.text((82, 300), "Leave your agent's trail on-chain.", font=font(FR, 38), fill=ACCENT)
d.text((82, 370), "Daily check-in for Agent ID holders",
       font=font(FR, 32), fill=MUTED)
d.text((82, 415), "on BNB Chain — free, gas only.", font=font(FR, 32), fill=MUTED)
d.text((82, 540), "BINANCE AGENT ID HACKATHON  ·  60,000 USDC",
       font=font(FR, 28), fill=GOLD)
save(img, "slide-01-title.png")

# ---- 5. On-chain, Agent-ID-gated ----
img, d = base()
kicker(d, "HOW IT WORKS")
headline(d, "On-chain, Agent-ID-gated")
rows = [
    ("1  checkIn(note)", "One check-in per UTC day, note up to 140 chars."),
    ("2  Agent ID gate", "Contract checks balanceOf on the Agent ID contract."),
    ("3  Streaks", "Consecutive days build your streak; a miss resets it."),
    ("4  Events, not storage", "Notes are emitted as events — cheap gas, public trail."),
    ("5  No owner powers", "No admin functions. No token. No fees. No rewards promised."),
]
y = 200
for title, sub in rows:
    panel(d, [80, y, 1200, y + 78])
    d.text((110, y + 12), title, font=font(FB, 28), fill=WHITE)
    d.text((110, y + 44), sub, font=font(FR, 22), fill=MUTED)
    y += 92
save(img, "slide-05-chain.png")

# ---- 6. Close ----
img, d = base()
kicker(d, "AGENTTRAIL")
headline(d, "Show up. Every day.")
d.text((82, 210), "One check-in a day is all it takes to leave",
       font=font(FR, 32), fill=MUTED)
d.text((82, 255), "your agent's mark on BNB Chain.",
       font=font(FR, 32), fill=MUTED)
panel(d, [80, 340, 1200, 470])
d.text((110, 362), "Try it live:  nmhl21.github.io/agenttrail",
       font=font(FB, 30), fill=WHITE)
d.text((110, 412), "Code:  github.com/nmhl21/agenttrail",
       font=font(FB, 30), fill=ACCENT)
d.text((82, 540), "BINANCE AGENT ID HACKATHON",
       font=font(FR, 28), fill=GOLD)
save(img, "slide-06-close.png")
