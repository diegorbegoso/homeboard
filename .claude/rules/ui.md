---

description: UI, tokens, Spanish copy, motion and accessibility conventions
paths:

- "src/app/**/*.tsx"
- "src/components/**"
- "src/app/globals.css"

---

# Interfaz

- Colors only through tokens: `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`, `bg-primary text-on-primary`, `bg-primary-soft`, `text-success`, `text-destructive`. A raw hex outside `globals.css` is a defect — the only exceptions are `viewport.themeColor` in `src/app/layout.tsx` and the colors in `src/app/manifest.ts`, which must be literals.
- Radius: `rounded-card` (20px) for cards, `rounded-input` (14px) for inputs, `rounded-full` for buttons.
- Every interactive element is at least 44px tall (`min-h-11`). Icon-only buttons carry an `aria-label` in Spanish.
- Icons: `@phosphor-icons/react` (`weight="regular"`; `weight="duotone"` on micro-app tiles). In Server Components import from `@phosphor-icons/react/ssr`. No emoji as icons.
- Every list has loading, empty and error states. Empty copy is friendly: `Nada por comprar. ¡Qué paz!`.
- Errors render as text in an element with `role="alert"` — never color alone.
- Motion: `import { AnimatePresence, motion, useReducedMotion } from "motion/react"`. Springs (`type: "spring", stiffness: 500, damping: 40`) or 150–250 ms; exits about 65% of enter; stagger new realtime items 40 ms. When `useReducedMotion()` is true, render without animation.
- Toasts: `toast()` from `sonner`; destructive actions offer `Deshacer` for 5 s.
- Copy: Spanish, tú, short, warm. Labels are a contract with `tests/e2e/helpers.ts` — never reword `Correo`, `Contraseña`, `Nombre`, `Entrar`, `Crear cuenta`, `Nombre del hogar`, `Crear hogar`, `Código de invitación`, `Unirme`.
