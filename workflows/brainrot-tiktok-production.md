# Brainrot TikTok Production Workflow

A forge-temper workflow that produces **one** short-form vertical "brainrot" TikTok per run, with an idea-mining loop and a production/verification loop. Every agent runs on a Claude subscription model except the **Video Producer**, which uses OpenRouter's `google/veo-3`.

## Pipeline overview

1. **Brainrot Brief** (idea) — seed prompt describing the target niche/audience.
2. **Trend Miner** (Claude Sonnet) — mines viral formats/sounds/memes, emits 10 concept seeds.
3. **Virality Judge** (Claude Opus, verifier) — scores concepts; loops back to the miner until the top concept scores ≥ 80, then passes the single winner forward.
4. **Script & Hook Writer** (Claude Sonnet) — turns the winning concept into one shot-by-shot script.
5. **Video Producer** (OpenRouter `google/veo-3`) — generates the ordered 9:16 shot clips.
6. **Final Cut Editor** (Claude Sonnet) — concatenates shots into exactly one 15–30s MP4.
7. **Retention QC** (Claude Opus, verifier) — checks the single video; loops back to the editor on failure, else approves.
8. **Clip Vault** (warehouse) — accumulates the approved video + script + metadata across runs.

## Loops

- **Idea-mining loop:** Virality Judge → Trend Miner (feedback) until score ≥ 80.
- **Production/verification loop:** Retention QC → Final Cut Editor (feedback) until all QC checks pass.

## Graph definition

```json
{
  "nodes": [
    {"id":"seed","kind":"idea","label":"Brainrot Brief","config":{"text":"Produce ONE short-form vertical 'brainrot' TikTok per run: hyper-fast, meme-saturated, high-retention clip. Target niche/audience here.","symbol":"Lightbulb","color":"#f59e0b"}},
    {"id":"miner","kind":"custom","label":"Trend Miner","config":{"prompt":"Mine current viral TikTok formats, sounds, memes and brainrot tropes relevant to the brief. Output 10 raw concept seeds with hook angles and why each could pop.","provider":"claude","model":"claude-sonnet-4-6","effort":"medium","symbol":"Search","color":"#0ea5e9","toolScope":"web"}},
    {"id":"ideajudge","kind":"custom","label":"Virality Judge","config":{"prompt":"Score each concept for hook strength, watch-through potential, meme-density and trend timeliness (0-100). If the best concept scores under 80, return targeted feedback for re-mining. Otherwise pass the SINGLE top concept forward.","provider":"claude","model":"claude-opus-4-8","effort":"high","symbol":"Scale","color":"#a855f7","verifier":true,"passCondition":"top concept score >= 80"}},
    {"id":"script","kind":"custom","label":"Script & Hook Writer","config":{"prompt":"Turn the ONE winning concept into a single 15-30s shot-by-shot script: 0-2s scroll-stopping hook, rapid cuts, on-screen caption text, sound/SFX cues, and a video-generation prompt per shot. All shots belong to one cohesive clip.","provider":"claude","model":"claude-sonnet-4-6","effort":"medium","symbol":"PenTool","color":"#ec4899"}},
    {"id":"producer","kind":"custom","label":"Video Producer","config":{"prompt":"Generate the vertical 9:16 brainrot video shots from each shot prompt and caption track. Apply fast cuts, zooms, and meme overlays per the script. Incorporate any reviewer feedback to regenerate weak shots. Output the ordered shot clips for assembly.","provider":"openrouter","model":"google/veo-3","effort":"medium","symbol":"Rocket","color":"#22c55e"}},
    {"id":"editor","kind":"custom","label":"Final Cut Editor","config":{"prompt":"Concatenate the ordered shot clips into EXACTLY ONE continuous vertical 9:16 MP4: stitch shots in script order, sync captions and audio track, normalize timing to 15-30s, and export a single final video file. Always output one and only one video.","provider":"claude","model":"claude-sonnet-4-6","effort":"medium","symbol":"Feather","color":"#14b8a6"}},
    {"id":"qc","kind":"custom","label":"Retention QC","config":{"prompt":"Review the SINGLE assembled video for hook impact in first 2s, pacing/retention, caption sync, brand safety and platform compliance. If it fails any check, emit precise regeneration feedback to the editor. Otherwise approve the one final video.","provider":"claude","model":"claude-opus-4-8","effort":"high","symbol":"Shield","color":"#ef4444","verifier":true,"passCondition":"single video passes all QC checks"}},
    {"id":"archive","kind":"warehouse","label":"Clip Vault","config":{"collect":"the one approved video + script + metadata","warehouseName":"brainrot-clips","symbol":"BookOpen","color":"#6366f1"}}
  ],
  "edges": [
    {"from":"seed","fromPort":"idea","to":"miner","toPort":"in","feedback":false},
    {"from":"miner","fromPort":"out","to":"ideajudge","toPort":"in","feedback":false},
    {"from":"ideajudge","fromPort":"out","to":"miner","toPort":"feedback","feedback":true},
    {"from":"ideajudge","fromPort":"out","to":"script","toPort":"in","feedback":false},
    {"from":"script","fromPort":"out","to":"producer","toPort":"in","feedback":false},
    {"from":"producer","fromPort":"out","to":"editor","toPort":"in","feedback":false},
    {"from":"editor","fromPort":"out","to":"qc","toPort":"in","feedback":false},
    {"from":"qc","fromPort":"out","to":"editor","toPort":"feedback","feedback":true},
    {"from":"qc","fromPort":"out","to":"archive","toPort":"in","feedback":false}
  ]
}
```

## Schedule

Runs daily at **08:00** via a Claude Code cron job.
