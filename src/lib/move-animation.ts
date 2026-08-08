/**
 * Port of YTSubConverter's frame-based animation expansion (Util/TimeUtil.cs +
 * Animations/Animator.cs + Animations/MoveAnimation.cs), scoped down to the one animation type
 * this project supports: ASS \move. YTT has no native tweened position, so a \move is instead
 * simulated by splitting the line into a burst of static position snapshots, stepped two video
 * frames at a time, exactly like the reference implementation does.
 *
 * The reference assumes a fixed ~29.97fps (NTSC) timeline for its frame math regardless of the
 * source video's actual frame rate — TimeUtil.cs hardcodes 33.36666666666667ms/frame with no
 * project-level fps input, so we do the same here rather than inventing a frame rate to parse
 * out of the ASS file.
 */

/** ms per frame at 30000/1001 (~29.97fps), matching YTSubConverter's TimeUtil.cs constant. */
const FRAME_MS = 1001 / 30

function startTimeToFrame(ms: number): number {
    if (ms <= 0) return 0
    return endTimeToFrame(ms) + 1
}

function endTimeToFrame(ms: number): number {
    return Math.floor((ms + 1) / FRAME_MS)
}

function frameToTime(frame: number): number {
    if (frame === 0) return 0
    return Math.floor(frame * FRAME_MS)
}

function frameToStartTime(frame: number): number {
    if (frame <= 0) return 0
    return frameToTime(frame) - 16
}

function frameToEndTime(frame: number): number {
    return frameToTime(frame) + 16
}

/** TimeUtil.RoundTimeToFrameCenter: snaps a timestamp to the start of the frame it falls in. */
function roundTimeToFrameCenter(ms: number): number {
    if (ms <= 0) return 0
    return frameToStartTime(startTimeToFrame(ms))
}

export interface MoveSnapshot {
    startMs: number
    endMs: number
    x: number
    y: number
}

/**
 * Expands a single \move(x1,y1,x2,y2,t1,t2) into a sequence of contiguous, gapless static
 * position snapshots covering [lineStartMs, lineEndMs). Mirrors Animator.Expand for the
 * single-MoveAnimation case (no multi-animation clustering, since \move is the only animation
 * this converter deals with).
 *
 * Caller is expected to have already validated animEndMs > animStartMs; degenerate/invalid
 * moves should be handled by the caller falling back to a single static entry instead of
 * calling this function, matching YTSubConverter dropping the animation entirely in that case.
 */
export function expandMoveSnapshots(
    lineStartMs: number,
    lineEndMs: number,
    animStartMs: number,
    animEndMs: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
): MoveSnapshot[] {
    const snapshots: MoveSnapshot[] = []

    const setPrevEnd = (endMs: number) => {
        if (snapshots.length > 0) snapshots[snapshots.length - 1].endMs = endMs
    }

    // CreateInitialLine: the move's StartTime is always >= the line's Start here (t1 is
    // clamped to >= 0 by the caller), so the animation is applied at t=0 -> start position.
    const initialStart = roundTimeToFrameCenter(lineStartMs)

    // Cluster range: intersect the move's active window with the line, then snap both ends
    // to frame centers.
    let clusterStart = Math.max(animStartMs, lineStartMs)
    let clusterEnd = Math.min(animEndMs, lineEndMs)
    clusterStart = roundTimeToFrameCenter(clusterStart)
    clusterEnd = roundTimeToFrameCenter(clusterEnd)

    // Leading static snapshot at the start position, before the move becomes active.
    if (clusterStart > initialStart) {
        snapshots.push({ startMs: initialStart, endMs: clusterStart, x: x1, y: y1 })
    }

    // Stepped interpolation across the cluster range, 2 frames per snapshot.
    if (clusterEnd > clusterStart) {
        const rangeStartFrame = startTimeToFrame(clusterStart)
        const rangeEndFrame = endTimeToFrame(clusterEnd)
        const FRAME_STEP = 2

        const subStepFrames = (((rangeEndFrame + 1 - rangeStartFrame) % FRAME_STEP) + FRAME_STEP) % FRAME_STEP
        const lastIterationFrame = rangeEndFrame + 1 - subStepFrames - FRAME_STEP

        const animStartFrame = startTimeToFrame(animStartMs)
        const animEndFrame = endTimeToFrame(animEndMs)

        for (let frame = rangeStartFrame; frame <= lastIterationFrame; frame += FRAME_STEP) {
            const fStart = frameToStartTime(frame)
            const fEnd = frame < lastIterationFrame ? frameToEndTime(frame + FRAME_STEP - 1) : clusterEnd
            const interpFrame = frame + (FRAME_STEP - 1) / 2

            let x: number
            let y: number
            if (interpFrame >= animStartFrame && interpFrame < animEndFrame) {
                const t = (interpFrame - animStartFrame) / (animEndFrame - animStartFrame)
                x = x1 + (x2 - x1) * t
                y = y1 + (y2 - y1) * t
            } else if (interpFrame >= animEndFrame && interpFrame < animEndFrame + FRAME_STEP) {
                x = x2
                y = y2
            } else {
                // Falls outside both windows (can only happen for a cluster shorter than one
                // frame step, before the animation has properly started) — hold the start pos.
                x = x1
                y = y1
            }

            setPrevEnd(fStart)
            snapshots.push({ startMs: fStart, endMs: fEnd, x, y })
        }
    }

    // Trailing static snapshot at the end position, after the move has finished.
    if (lineEndMs > clusterEnd) {
        setPrevEnd(clusterEnd)
        snapshots.push({ startMs: clusterEnd, endMs: lineEndMs, x: x2, y: y2 })
    }

    if (snapshots.length > 0) {
        snapshots[snapshots.length - 1].endMs = lineEndMs
    }

    return snapshots
}
