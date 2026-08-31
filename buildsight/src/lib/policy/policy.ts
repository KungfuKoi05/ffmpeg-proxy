/**
 * Policy layer.
 *
 * BuildSight is a configuration, visualization, compatibility, inventory and
 * purchasing-planning platform. This module is the single place that decides
 * whether a free-text request falls inside that boundary, and it is applied to
 * every free-text surface: the SCOPE assistant, the natural-language builder,
 * saved-search names and user-submitted catalog notes.
 *
 * The classifier is deterministic keyword matching, not a model call, so the
 * boundary cannot drift with a prompt.
 */

export type RestrictedCategory =
  | "MANUFACTURING"
  | "MACHINING"
  | "AUTOMATIC_CONVERSION"
  | "SAFETY_DEFEAT"
  | "ILLEGAL_MODIFICATION"
  | "AMMUNITION_LOADING"
  | "OPERATIONAL_INSTRUCTION";

export interface PolicyDecision {
  allowed: boolean;
  category: RestrictedCategory | null;
  /** Message shown to the user when a request is refused. */
  message: string;
  /** In-product places the user is redirected to instead. */
  redirects: Array<{ label: string; href: string }>;
  matched: string[];
}

interface Matcher {
  category: RestrictedCategory;
  patterns: RegExp[];
  message: string;
}

const CATALOG_REDIRECTS = [
  { label: "Browse the component catalog", href: "/catalog" },
  { label: "Open the Build Studio", href: "/studio" },
  { label: "Read the documentation policy", href: "/docs/policy" },
];

const MATCHERS: Matcher[] = [
  {
    category: "MANUFACTURING",
    patterns: [
      /\b(?:how\s+to\s+)?(?:build|make|manufactur\w*|fabricat\w*|produc\w*)\s+(?:a\s+|an\s+|my\s+own\s+)?(?:gun|firearm|receiver|lower|frame|ghost\s*gun)\b/i,
      /\b(?:80|eighty)\s*%?\s*(?:percent\s*)?(?:lower|frame|receiver)\b/i,
      /\bunserialized\s+(?:receiver|lower|frame)\b/i,
      /\bhome[-\s]?(?:built|manufactur\w*)\s+(?:firearm|receiver|lower)\b/i,
      /\b3d\s*print\w*\s+(?:a\s+)?(?:gun|firearm|receiver|lower|frame)\b/i,
    ],
    message:
      "BuildSight does not provide instructions for manufacturing firearms or regulated components. It works from manufacturer-published specifications for commercially available products.",
  },
  {
    category: "MACHINING",
    patterns: [
      /\b(?:cnc|mill(?:ing)?|drill(?:ing)?|jig|machin\w*)\b[^.?!]{0,40}\b(?:receiver|lower|frame|sear|trigger\s*pocket)\b/i,
      /\b(?:cad|cam|g-?code|dxf|step\s*file)\b[^.?!]{0,40}\b(?:receiver|lower|frame|sear)\b/i,
      /\b(?:blueprint|technical\s+drawing)s?\s+to\s+(?:machine|mill|manufacture|make)\b/i,
    ],
    message:
      "BuildSight does not generate machining, CAD or CAM instructions for producing firearm components. Dimensional data here is for visualization and fitment checking only.",
  },
  {
    category: "AUTOMATIC_CONVERSION",
    patterns: [
      /\bfull[-\s]?auto(?:matic)?\b[^.?!]{0,30}\b(?:convert\w*|conversion|make|turn|modif\w*)\b/i,
      /\b(?:convert\w*|turn|modif\w*)\b[^.?!]{0,30}\bfull[-\s]?auto(?:matic)?\b/i,
      /\b(?:auto\s*sear|drop[-\s]?in\s+auto|lightning\s+link|dias\b|forced\s+reset\s+trigger|frt[-\s]?15)\b/i,
      /\bselect[-\s]?fire\s+conversion\b/i,
      /\bmachine\s*gun\s+conversion\b/i,
    ],
    message:
      "BuildSight does not provide information about converting a firearm to automatic fire. That is outside the product boundary and unlawful in most jurisdictions.",
  },
  {
    category: "SAFETY_DEFEAT",
    patterns: [
      /\b(?:defeat|bypass|disable|remove|deactivate|circumvent)\b[^.?!]{0,30}\b(?:safety|safeties|drop\s+safety|firing\s+pin\s+block|trigger\s+disconnector|transfer\s+bar)\b/i,
      /\bmake\b[^.?!]{0,20}\bfire\s+without\b[^.?!]{0,20}\btrigger\b/i,
    ],
    message:
      "BuildSight does not provide information about defeating or removing safety mechanisms.",
  },
  {
    category: "ILLEGAL_MODIFICATION",
    patterns: [
      /\b(?:remove|obliterate|grind\s+off|deface)\b[^.?!]{0,30}\bserial\s+number\b/i,
      /\bunregistered\s+(?:suppressor|silencer|sbr|short[-\s]barrel\w*)\b/i,
      /\b(?:solvent\s+trap|fuel\s+filter)\b[^.?!]{0,30}\b(?:suppressor|silencer|convert\w*)\b/i,
      /\b(?:avoid|evade|get\s+around|skip)\b[^.?!]{0,30}\b(?:nfa|atf|background\s+check|form\s*[14]|registration)\b/i,
      /\bsbr\b[^.?!]{0,30}\bwithout\b[^.?!]{0,30}\b(?:stamp|form|registration|paperwork)\b/i,
    ],
    message:
      "BuildSight does not provide information about illegally modifying regulated components or avoiding legal requirements. Regulated items are routed to the manufacturer's or retailer's normal purchasing process.",
  },
  {
    category: "AMMUNITION_LOADING",
    patterns: [
      /\b(?:load\s+data|reload(?:ing)?\s+(?:recipe|data|manual)|powder\s+charge|charge\s+weight|grains?\s+of\s+\w+|handload\w*)\b/i,
      /\b(?:how\s+much|what)\b[^.?!]{0,25}\bpowder\b[^.?!]{0,25}\b(?:load|charge|use)\b/i,
      /\bwildcat\s+(?:load|cartridge)\s+(?:recipe|data)\b/i,
    ],
    message:
      "BuildSight does not provide ammunition loading data or firing recipes. Consult published load manuals from a component manufacturer.",
  },
  {
    category: "OPERATIONAL_INSTRUCTION",
    patterns: [
      /\bhow\s+(?:do\s+i|to)\b[^.?!]{0,20}\b(?:shoot|fire|aim\s+at)\b[^.?!]{0,25}\b(?:person|people|someone|target\s+practice\s+on\s+\w+)\b/i,
      /\b(?:clear|engage)\s+a\s+(?:room|building)\b/i,
    ],
    message:
      "BuildSight does not provide operational instructions for using a firearm. It documents components, dimensions and compatibility.",
  },
];

const ALLOWED_HINTS =
  /\b(compatib\w*|dimension\w*|clearance|weight|price|cost|catalog|spec\w*|thread\s+spec\w*|handguard|barrel\s+length|optic|mount|shopping\s+list|watchlist|build)\b/i;

/**
 * Classify a free-text request against the product boundary.
 *
 * Restricted matches win over allowed hints: a question that mixes a catalog
 * topic with a restricted one is still refused.
 */
export function classifyRequest(text: string): PolicyDecision {
  const input = text ?? "";
  for (const matcher of MATCHERS) {
    const matched = matcher.patterns
      .map((pattern) => pattern.exec(input)?.[0])
      .filter((value): value is string => Boolean(value));
    if (matched.length > 0) {
      return {
        allowed: false,
        category: matcher.category,
        message: matcher.message,
        redirects: CATALOG_REDIRECTS,
        matched,
      };
    }
  }

  return {
    allowed: true,
    category: null,
    message: "",
    redirects: [],
    matched: ALLOWED_HINTS.test(input) ? [ALLOWED_HINTS.exec(input)?.[0] ?? ""] : [],
  };
}

export const ALLOWED_CAPABILITIES = [
  "Product visualization",
  "Product comparison",
  "Public manufacturer specifications",
  "Documented compatibility",
  "Price comparison and history",
  "Dimension visualization and clearance checks",
  "Inventory and watchlist tracking",
  "Shopping list organization",
  "Links to manufacturer documentation",
];

export const RESTRICTED_CAPABILITIES = [
  "Manufacturing instructions",
  "Machining, CAD or CAM instructions",
  "Weapon conversion instructions",
  "Automatic-fire conversion",
  "Safety mechanism defeat",
  "Ammunition or load recipes",
  "Instructions for illegal modifications",
  "Automated purchasing of regulated products",
];
