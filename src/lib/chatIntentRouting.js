/**
 * Route case-chat messages to tutor vs patient_sim.
 * Patient mode must not swallow clinical education or order rationale.
 */

export function looksLikeTutorQuestion(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const t = raw.toLowerCase().replace(/\s+/g, ' ');

  if (/^(what does|what do|what is|what are|why (order|does|do|is|would)|explain|how does|help me understand|what dies|whats|tell me about|walk me through|so (for|in|this|if)|let'?s try again)/i.test(raw)) {
    return true;
  }
  if (/^order\s+.+\b(to assess|because|as|for|help)\b/i.test(raw)) return true;
  if (
    /\b(complement|c3\/c4|\bc3\b|\bc4\b|pathophys|mechanism|differential|workup|rationale|nephritis|lupus nephritis|consumption|classical pathway|interpret|lab result|cytopenia|leukopenia|thrombocytopenia|petechiae|anti-dsdna|anti-dsdna|anti-smith|antismith|\bana\b|systemic lupus|\bsle\b|malar rash|autoimmune|hypocomplement|dsdna|topoisomerase|egfr|dialysis|sun exposure|photosensitivity)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (t.length > 120 && /\b(order|lab|cbc|bmp|workup|patient|assess|expect|indicate|criteria|guide|bones|kidney|renal|skin|blood)\b/.test(t)) {
    return true;
  }
  if (t.length > 160 && /\border\b/.test(t) && /\b(patient|assess|expect|indicate|criteria|guide)\b/.test(t)) {
    return true;
  }
  return false;
}
