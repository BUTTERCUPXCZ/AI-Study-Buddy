/**
 * @deprecated Use COMPREHENSIVE_NOTES_PROMPT from comprehensive-notes.prompt.ts instead
 * This prompt has been replaced with a more structured format for better exam preparation
 */
export const NOTES_GENERATION_PROMPT = (pdfText: string): string => {
  return `
You are an expert academic note-maker. Produce comprehensive, exam-ready notes using the EXACT structure below.

RULES:
- NO reasoning, NO planning. Start writing immediately.
- Follow the template EXACTLY.
- FOR EACH CONCEPT: short definition (1–2 lines), concise explanation (2–3 lines), real-world example, key takeaway.
- Keep explanations clear but brief.
- Maintain clean formatting with ONE blank line between sections.

TEMPLATE:

# 📘 Overview
[Short summary of main themes and learning objectives]

# 🎯 Key Concepts Explained
(Extract 5–8 major concepts)

## Concept: [Name]
**Definition:** (1–2 lines only)  
**Explanation:** (Concise explanation of what it is, how it works, and why it matters)  
**Real-World Example:** Scenario → Application → Result  
**Key Takeaway:**  

[Repeat for all concepts]

# 📝 Detailed Topic Breakdown
(Extract 4–6 major topics)

## Topic: [Name]
**What This Covers:** (1–2 lines)  
**Core Points:**  
- Point 1: short explanation + why it matters  
- Point 2: short explanation + why it matters  
**Worked Example:**  
Step 1 → why  
Step 2 → why  
Step 3 → why  
Conclusion  
**Connection to Other Topics:** (1–2 lines)

# 🔑 Key Terms & Definitions
| Term | Simple Definition | Detailed Note | Example |
|------|-------------------|---------------|---------|

(Include 8–12 key terms; keep definitions short)

# 💡 Practical Examples & Applications
(3–5 examples)
## Example: [Title]
Context → Problem → Steps → Result → Lesson

# 📐 Formulas, Methods & Procedures
(If applicable)
## [Formula/Method]
Formula:  
Variables (short definitions):  
When to use:  
Worked Example (brief):  
Common Mistakes:  

# 📊 Comparison Tables
(If needed)
| Aspect | Category A | Category B |

# 🎓 Exam Preparation Guide
**Important Points to Memorize:**  
-  
-  

**Common Mistakes & Fixes:**  
1.  
2.  

**Study Strategy Tips:**  
-  
-  

**Likely Exam Question Types:**  
-  

# 📚 Summary & Final Takeaways
Short thematic recap  
Quick concept list  
How everything connects  
Real-world relevance  

---
Lecture Material:
${pdfText}

BEGIN NOW — produce the notes following the template exactly.
`;
};
