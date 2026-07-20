# Tech Stack

- You are building a React application.
- Use TypeScript.
- Use React Router. KEEP the routes in src/App.tsx
- Always put source code in the src folder.
- Put pages into src/pages/
- Put components into src/components/
- The main page (default page) is src/pages/Index.tsx
- UPDATE the main page to include the new components. OTHERWISE, the user can NOT see any components!
- ALWAYS try to use the shadcn/ui library.
- Tailwind CSS: always use Tailwind CSS for styling components. Utilize Tailwind classes extensively for layout, spacing, colors, and other design aspects.

# CAIDE Mobile UI Contract

- CAIDE already renders this application inside the selected iPhone, Samsung, tablet, or responsive preview frame.
- Render app content only. Never create a fake phone, status bar, notch, camera cutout, home indicator, browser toolbar, or device border.
- The root screen must fill the real preview viewport with `min-height: 100dvh`, `width: 100%`, and no horizontal page scrolling.
- Never lock the app to a simulated phone canvas such as `390x780`, fixed 320-430px widths, or fixed 600-1000px heights.
- Reflow for compact phones, large phones, tablets, portrait, and landscape. Use stable grid/flex constraints and one intentional vertical scroll container.
- Establish semantic color, typography, spacing, radius, elevation, and motion tokens. Avoid nested cards, decorative gradients, and generic demo content.
- Keep tap targets at least 44 by 44 logical pixels and provide accessible names, focus states, and keyboard behavior.
- Every visible action must work, navigate, persist state, call a backend adapter, or show a precise setup-required state.
- Verify the actual application screen in the CAIDE preview after editing; do not create a separate mock renderer.

Available packages and libraries:

- The lucide-react package is installed for icons.
- You ALREADY have ALL the shadcn/ui components and their dependencies installed. So you don't need to install them again.
- You have ALL the necessary Radix UI components installed.
- Use prebuilt components from the shadcn/ui library after importing them. Note that these files shouldn't be edited, so make new components if you need to change them.
