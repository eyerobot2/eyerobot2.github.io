# Website feedback log

Living record of feedback on the EyeRobot 2.0 website. Add new feedback here as it arrives, preserve the original wording, and address items one at a time. Capturing feedback does not authorize implementing every suggestion.

Last updated: 2026-10-01. Initial status assessment refers to branch `intro-wrist-camera-updates`, commit `15bdd43`, not verified deployment on the public website. Statuses are the assistant’s audit assessments, not reviewer sign-off.

## Working agreement

- Give each new item a stable ID. Keep resolved items and their history.
- Record when feedback was received; do not infer when older feedback was originally given.
- Link repeated feedback to the original item while preserving new details or wording.
- Distinguish reviewer feedback, our interpretation, proposed work, and accepted decisions.
- Before implementing an item, agree which item we are addressing. Update its status, changes, and validation afterward.
- Record whether a change is local, committed, pushed, or deployed. A pushed branch is not a deployed website.
- Do not call placeholders or an unverified fix complete.

Statuses: **Open**, **Partial**, **Addressed**, **Unverified**, **Deferred**, **In progress**. Addressed means an implementation exists, not that every reviewer has accepted it.

Current item in progress: none. Next item: not yet selected.

## Main concern

**F025 — Open.** The largest unresolved concern is whether the page convincingly motivates manipulation without wrist cameras. This overlaps F008, F012, F014, F015, and F016. The audit recommends distinguishing evidence that wrist cameras are unnecessary for these demonstrated capabilities from a claim that wrist cameras never help or cannot complement EyeRobot. That recommendation is not yet approved copy.

## Feedback received on 2026 10 01

Source: the user pasted historical website feedback. Original feedback date and individual authors are unspecified except where named in the text. Quotes below preserve the submitted wording.

### F001 Explain the boba task

> What is this boba experiment (say the task)?

**Addressed.** Intro inset says “Insert straw into cup”; the main rollout caption also describes insertion and coaster placement. Included in `15bdd43`.

### F002 Explain camera movement earlier

> Videos are clear but how are we actually moving the camera, that comes to late,

**Open.** Detailed gaze control and synthesized views appear after the first main results carousel. Proposed next step: an early setup visual distinguishing actual camera control from view synthesis used for training.

### F003 Caption task stages

> Don't understand the task, put 3-4 word caption of what the task stages are supposed to be

**Partial.** Main rollouts have short task-sequence captions; boba and pot inset labels name the tasks. Current stages are not consistently labeled during playback. Scope for stage-by-stage overlays remains to be decided.

### F004 Explain the benefit before the drawbacks

> Wrist cameras aren't ideal is unclear--- it's supposed to be framed that wrist cameras are annoying but they're a necessary evil

**Partial.** Intro shows local resolution and token benefits, performance gains, then occlusion and bulk. It says wrists have been necessary for manipulation. The framing still needs review alongside F008/F014; avoid turning this into an unsupported universal necessity claim.

### F005 Teaser size and browser zoom

> Video is much smaller on David's computer, as he zooms out the video gets bigger.

**Unverified.** Teaser sizing depends on remaining viewport height and responsive title sizing. This is a possible cause, not a confirmed reproduction. Need browser, viewport, display scaling, and zoom checks matching the reported case.

### F006 Explain setup before benefits

> How it works should be re-ordered with the setup first and then talk about the benefits, need to know the setup first (maybe even right before See what EyeRobot 2.0 sees)

**Open.** “How it works” still follows “See what EyeRobot 2.0 sees.” Related to F002 and F021.

### F007 Add a method jump link

> Have link in the middle to jump to how it works

**Open.** Module links exist within the method overview, but there is no clear earlier jump to the whole method explanation.

### F008 Motivate removing wrist cameras

> Unclear why should we get rid of wrist cameras?

**Partial.** The page now shows wrist benefits and specific drawbacks, but the reason to prefer a wrist-free design is not yet fully established. Related to F014 and F025.

### F009 Add exo context to wrist examples

> Find a way to have the exo for the wrist camera examples so it is more clear (peple don't know our tasks so we gotta be clear about it)

**Addressed for the intro.** Boba and pot have synchronized bottom-left exo insets with concise task labels. The boba intro uses an alternate take with all three camera streams. Later experimental comparison videos have not all received these insets. Included in `15bdd43`.

### F010 Reconsider the manifold argument

> The 1 2 3 compacting the data manifold with fixation, that doesn't necessarily make a neural net better (maybe this shouldn't be the first thing)

**Partial.** The manifold section comes after the method rather than first. The broad “three ways to make a neural net better” claim remains and still needs qualification or replacement.

### F011 Show broader occlusion examples

> In the why wrist cameras not ideal, we should emphasize/show more occlusion reasons, do example not of our data (I think we could have a carousel of examples)

**Partial.** A five-slide occlusion carousel contains boba and pot videos plus grey drill, box-lifting, and screwdriver placeholders. Need actual broader examples; placeholders are not evidence.

### F012 Acknowledge when wrist views help

> Isn't wrist camera also helping occluded situations when the top camera can't see?

**Open.** No direct acknowledgement of complementary wrist visibility when an exo view is blocked. Related to F014; this should be answered fairly rather than implying a universally better viewpoint.

### F013 Define the audience

> Who's the audience? Robot learning people (people who specialize in dexterous manipulation for human demos)

**Partial.** Record this as the intended audience. The page has relevant technical depth, but the framing and examples have not been systematically revised for this audience.

### F014 Answer why not combine both

> It's not hitting because people will just be like why not just add on wrist cameras with eyeball, breakdown of the failures

**Open.** Failure and baseline comparisons exist later, but the page does not directly answer the combined-system question. Existing comparisons do not establish that adding wrist cameras to EyeRobot would be unhelpful. Related to F008/F012/F025.

### F015 Emphasize foveated detail

> I think we need to emphasize foveated inputs more (we want high resolution where we are manipulating, and that's why wrist cameras are important, but they're annoying for xyz, )

**Partial.** Opening resolution sweep and selected wrist-token figure make the local-detail motivation concrete. EyeRobot’s foveated solution is explained later; the early connection could be stronger.

### F016 Demonstrate decoupling vision and action

> We need to give clear examples why you should decouple vision and action

**Partial.** Later tracking, switching, and retry examples help, but an early explicit demonstration of looking independently of hand motion is missing. Also raised in KH note F027.

### F017 Introduce selection earlier

> We should emphasize task selection earlier

**Partial.** The target selector leads the method overview and sequencing section but appears after the first results. The feedback says “task selection”; the audit interprets this as target selection, which should be confirmed if the distinction affects the edit.

### F018 Remove stereo from the title

> Get rid of stereo (David's title: EyeRobot 2.0: Precise Manipulation without Wrist Cameras)

**Addressed in substance.** The current title is “EyeRobot 2.0: Active Gaze for Precise Manipulation without Wrist Cameras.” It omits stereo but is not word-for-word David’s proposed title.

### F019 Clarify action output and coordinate frames

> Stereo policy centered on fixation doesn't make clear where the gripper is being outputted, figure on right subplot, makes you think fixation frame and the camera frame is the same thing (if this was an animation where the fixation was moving)

**Partial.** Gripper-policy caption explains fixation-relative predictions and conversion back to robot coordinates. An interactive world/fixation trajectory comparison exists. There is not yet a direct moving-fixation demonstration distinguishing fixation and camera frames.

### F020 Separate website and talk feedback

> Disentangle comments between blog and talk

**Open.** This log tracks website feedback; talk-specific items should be tagged separately when supplied. The two KH notes currently remain visible on the website by explicit request. Removing those notes requires a later publishing decision, not an assumption.

### F021 Add a complete overview figure

> We don't have good overview figure of all the things that happen

**Partial.** Three method module summaries and a sequencing/reward figure exist. An early, complete setup-to-action overview is still missing.

### F022 Organize around the reward

> Focus everything on the reward

**Partial.** BC prediction accuracy is explicit in the sequencing explanation and reward-loop diagram. It does not organize the earlier narrative. Clarify scope before restructuring the entire page around it.

### F023 Explain why a selector is needed

> Then make it clear why we need the target selector

**Partial.** What the selector does is explained. Why a goal-conditioned gaze controller cannot itself decide which object should be attended to next could be clearer.

### F024 Use moving tape footage

> Replace learning goal-conditioned gaze video with actual moving video of the tape moving, then it shows that things are more useful for failure correction

**Partial.** Goal-conditioned gaze has real tracking and yellow-to-gray switching videos, including a changing goal label. The connection to manipulation failure correction is not yet explicit.

### F025 Main motivation still does not convince

> [1:31 PM]Okay hmm I think the biggest thing is that we don't really convince why no wrist cameras

**Open.** Primary narrative concern. Do not close simply because more videos or explanatory paragraphs were added. Reviewer acceptance of the revised motivation is still needed.

## Earlier editorial feedback from this conversation

These notes were supplied before the historical feedback batch; the precise original date is not recorded here.

### F026 Color consistency

> KH: Ik the Claude orange color is cringe, but a little confusing we highlight everything in blue and then for the graph we have our method in orange.

**Open.** Visible below the teaser. No consistent site-wide color decision has been applied. The rejected sequencing-color explorations do not resolve this item.

### F027 Visual examples for decoupling and human data

> KH: I think we should talk about the decoupling vision/action and human data too but we need some visual examples of it, or else I don't think the reason will hit as hard

**Open.** Visible below the question about avoiding wrist-camera drawbacks. Related to F016 and the audience in F013. The human-demonstration motivation also needs visual support.

### F028 Sequencing figure styling

> Can we make the sequencing gaze image look cooler, it looks pretty bland right now. Try alternate versions or alternate color schemes

**Deferred.** Four vector color/style alternatives were produced locally. User rejected them and explicitly chose to ignore this for now. Keep the original main-site figure. The alternatives were not included in the pushed branch.

## Additional feedback received on 2026 10 01

### F029 Clarify what wrist camera occlusion means

> It looks really good! My only minor comment is: "Manipulation necessarily occludes wrist cameras" I think what you meant to say was Manipulation necessarily causes objects to be occluded in the wrist camera view?

**Open.** Source: reviewer feedback relayed by the user; reviewer identity unspecified. The quoted sentence is from an earlier version. The current paragraph starts “Wrist cameras can get easily occluded by manipulation of large objects,” so ambiguity about what is occluded remains relevant. Related to F004, F008, and F011.

Interpretation: distinguish blocking the camera’s view of a relevant object or contact region from occluding the camera hardware itself. The reviewer’s proposed wording retains “necessarily,” which should also be reviewed rather than adopted automatically.

Possible wording for discussion, not approved or applied: “During manipulation, held objects can block wrist cameras’ view of the task, hiding the object or contact point the robot needs to see.” Check the wording against both the boba and pot examples when addressing this item. No website changes made in response yet.

### F030 Revise punctuation in the ego centric resolution sentence

> Would change: With only ego-centric views this is non-trivial, a single HD image requires 7500 tokens to represent!
>
> To
>
> With only ego-centric views, this is non-trivial (a single HD image requires 7500 tokens to represent!).

**Addressed.** Applied the user’s exact replacement in the introductory paragraph in `index.html` on 2026-10-01. This is a punctuation edit; the 7500-token claim is unchanged. Local change only, not committed or pushed.

### F031 Define RL and BC

> Define RL and BC

**Addressed.** Expanded reinforcement learning (RL) and behavior cloning (BC) at their first mentions in the rollout explanation. Added brief definitions: RL trains a policy to maximize reward; BC learns to predict actions from demonstrations. Clarified that the gaze sequencing reward is the BC policy’s prediction accuracy. Local change on 2026-10-01; not committed or pushed.

### F032 Clarify what available in real means

> “the method does not leverage any simulated information besides what is available in real.”
>
> Real _? Reality? Real life?

**Open.** The quoted wording is still present in the simulated-evaluation paragraph in `index.html`. The preceding phrase “robot positions as real” has the same shorthand problem. Suggested revision for discussion: “We use the same training method and settings as in the real-world experiments, without access to information unavailable to the real robot.” Confirm the exact claim before adopting that full rewrite. No website change yet.

### F033 Add a glossary for robotics terminology

> Can we have a vocab section or glossary at the bottom? Understand if some of these are common in ur field and don’t need definitions, but may be helpful for dummies like me
>
> - policy (in this context)
> - ego (again in this context)
> - proprioception
> - proprio

**Open.** Requested location: bottom of the page. Define terms in the context of this system rather than assuming robotics knowledge. Candidate explanations for review: a policy maps observations to actions; ego or egocentric means the robot’s own viewpoint; proprioception describes the robot’s own configuration or state, such as joint positions and eye orientation; “proprio” is shorthand for proprioception. Distinguish ego from exo consistently with the camera labels already used on the site. RL and BC can also be included, while retaining the first-use definitions added for F031. Related to F013. No glossary added yet.

### F034 Shorten the introduction and its wrist camera critique

> I think the intro spends too long dunking on wrist cameras. I think you can shorten or move the visual acuity part to later

**Open.** New feedback on pacing and tone. Consider a shorter, balanced benefit-and-tradeoff introduction, then introduce the setup and approach sooner. Shortening or relocating the visual-acuity explanation is a suggestion, not yet an accepted layout change. Reconcile with F004/F015, which request explaining wrist-camera benefits and high-resolution inputs, and F006, which requests setup earlier. More criticism alone does not resolve F025. Preserve the feedback about balance even if the eventual solution differs from moving the acuity figure. No sections moved yet.

### F035 Keep the page succinct despite its blog format

> Like ig it’s a blog post more than a project website but still feels like a project site where succinctness matters

**Open.** Treat as a page-wide editorial constraint, not only an introduction issue. Related to F034 and the audience in F013. When revising, prioritize a short readable path through motivation, setup, method, and results; decide which supporting detail belongs later or behind optional expansion. Those are proposed approaches, not approved structural changes. No website changes yet.

### F036 Click the small policy gaze view to enlarge it

> Also some minor notes
> I feel like u should be able to click on the small policy gaze window to enlarge it in See what EyeRobot 2.0 sees

**Open.** An “Enlarge gaze” button already exists in the results carousel and toggles which view is large. The small gaze window itself does not trigger that enlargement. Requested improvement: make the inset directly clickable/tappable, reusing the existing enlargement behavior while keeping playback controls and keyboard access usable. No interaction change yet.

### F037 Emphasize the separation of looking and acting

> Also “EyeRobot 2.0 separates where to look from how to act” or the latter half shud be bolder
> This is quite important

**Open.** User flags this as important. The method summary currently contains the sentence as plain text. Requested emphasis could cover the whole sentence or the “where to look” / “how to act” distinction; exact treatment remains to be chosen. Related to F016 and F021. No typography change yet.

### F038 Put tape demonstrations under the method overview modules

> I also think that the videos with the tape demonstrating the target elector and gaze policy should be earlier since that’s more illustrative than just describing them
> Like maybe even in the “how it works”
> Under each part of the 3 part module

**Open.** Proposed placement: embed short demonstrations beneath the relevant cards in the three-part “How it works” overview, so readers see the behavior as each module is introduced. Interpret “target elector” as “target selector.” Related to F006, F017, F021, F023, F024, and the succinctness constraint F035.

When addressing this item, distinguish the behaviors: a supplied yellow-to-gray goal switch demonstrates the goal-conditioned gaze policy responding to a new target; it does not by itself demonstrate the learned target selector deciding what to look at. Choose selector footage that shows its actual target choices or probabilities. Identify an appropriate gripper-policy example if all three cards receive a video. The exact clips and whether to move or repeat them are not yet decided. No videos moved yet.

## Accepted implementation decisions

- Use exo frame 363 to select the wrench moment. Timestamp matching gives left wrist frame 363 and right wrist frame 364.
- User selected 9 left-wrist and 32 right-wrist tokens. Exact indices are saved in `data/intro-wrists/selection.json`.
- Main intro figure contains only the paired wrist images and the caption “multiple visual tokens”; remove the extra exo reference card from this figure.
- For the occlusion videos, keep small bottom-left exo insets. Label the tasks “Insert straw into cup” and “Place lid on pot.”
- Keep the KH comments visible until explicitly asked to remove them.
- Retain both example carousels. Grey placeholders still need replacement with real examples.
- Keep rejected visual studies local and out of the main-site commit.

## Change history

- 2026-10-01: Logged F038: move illustrative tape demonstrations earlier, potentially beneath the corresponding three-part method overview modules. No website edit.
- 2026-10-01: Logged F035–F037: project-site succinctness, direct click-to-enlarge on the gaze inset, and stronger emphasis on decoupling looking and acting. Confirmed a separate enlargement button exists already. No website edits for these items yet.
- 2026-10-01: Logged F032–F034: clarify real-world wording, add a glossary, and shorten/rebalance the introduction. No website changes for these items yet.
- 2026-10-01: Added and addressed F031 with first-use definitions of RL and BC. Local only.
- 2026-10-01: Added F030 and applied the exact requested punctuation change in the introductory resolution sentence. Local only.
- 2026-10-01: Added F029 from newly relayed reviewer feedback about ambiguous wrist-camera occlusion wording. Logged only; no website edit.
- 2026-10-01: Recorded the historical feedback batch as F001–F025, earlier KH notes as F026–F027, and deferred sequencing styling as F028. Initial statuses are based on the audit of `15bdd43`.
- Existing implementation baseline: `15bdd43` was pushed to `origin/intro-wrist-camera-updates`. This includes wrist token highlights, contextual occlusion videos, example carousels, visible KH notes, and gaze-goal labels. Public deployment has not been verified.
- This documentation-only update includes the log and its README link. Website edits for F030 and F031 remain local and are not included in this commit; they have not been pushed or deployed.
