# Wael Scenario Canvas — Browser Verification Record

## Live interaction check

On the Majan mixed-use project, the unified canvas loaded with a visible control strip, twelve direct month cards, and a pinned dark decision-impact panel. April initially showed **6 units** and an immediate collection of **AED 2.1M** in project month 8.

A controlled unsaved change reduced April to **5 units**. The page immediately marked the scenario as a draft, identified the active change as **April — units**, reduced first-month collection to **AED 1.7M**, reduced the lowest escrow balance from **AED 25.9M** to **AED 25.3M**, and updated the monthly pulse without navigating away. This confirms that the impact panel consumes the current scenario state rather than requiring a separate page or save.

## Persistence check

The controlled April edit was saved through the single **Approve Wael Scenario** action and returned the success notification. After reopening the workspace, the browser DOM confirmed the approved record contained **5 units** and **3%** for April; the live impact panel also retained the corresponding **AED 1.7M** first collection and **AED 25.3M** lowest escrow balance.

The prior approved April value was then restored to **6 units**, verified immediately through the card value of **AED 20.8M**, first collection of **AED 2.1M**, and lowest escrow balance of **AED 25.9M**, then saved through the same single action. The project was therefore left on its original approved scenario after the test.

## Cross-project isolation check

The workspace was then opened for **Jaddaf Residential Building (G+7)** without saving any changes. It independently loaded its own 48-unit inventory, 18-month plan, **AED 86.7M** scenario revenue, **AED 10.8M** expected profit, **AED 361K** first collection, and **AED 2.9M** lowest escrow balance. This confirms the new canvas reads each project’s existing saved scenario rather than displaying Majan values across projects.

## Final restoration reload

After the original Majan value was restored and approved, the application was reloaded and the Financial Studies navigation reopened successfully. The final workspace reopening is used to confirm the restored approved record.

The selector state initially reopened the most recently viewed Jaddaf project, so the Financial Studies navigation was revisited to open Wael’s workspace and select Majan explicitly for the final record-level confirmation.

Majan then loaded with the original approved April record intact: **6 units**, **4%**, **AED 20.8M** projected April sale, **AED 2.1M** first collection, and **AED 25.9M** lowest escrow balance. This is the final save-reload confirmation that the controlled live-impact test did not alter the approved Majan scenario.

## Legacy-value display safeguard

On Jaddaf Residential Building, the saved legacy plan contained an invalid negative February entry. The rebuilt canvas originally revealed this as negative units and a negative projected sale. After applying the boundary guard, the browser shows **0 units**, **0%**, and **AED 0** for February, while the project’s existing saved scenario was left untouched. The safeguard prevents an invalid historic value from corrupting the live visual decision layer; it will normalize the stored manual array only when the user next approves a scenario.
