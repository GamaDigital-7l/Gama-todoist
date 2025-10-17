import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Nova Paleta de Cores - Dark Futurista
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))", // Fundo principal escuro
        foreground: "hsl(var(--foreground))", // Texto principal claro

        primary: {
          DEFAULT: "hsl(var(--primary))", // Roxo profundo
          foreground: "hsl(var(--primary-foreground))", // Texto para o roxo
          light: "hsl(var(--primary-light))", // Roxo mais claro para gradientes
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))", // Cinza escuro para elementos secundários
          foreground: "hsl(var(--secondary-foreground))", // Texto para o cinza
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))", // Vermelho para ações perigosas
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))", // Cinza para elementos secundários
          foreground: "hsl(var(--muted-foreground))", // Texto para o cinza
        },
        accent: {
          DEFAULT: "hsl(var(--accent))", // Cinza claro para hover/active
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))", // Fundo de popovers/menus
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))", // Fundo de cards
          foreground: "hsl(var(--card-foreground))",
        },
        // Cores de status para cards de tarefas (exemplo)
        status: {
          overdue: "var(--status-overdue)",
          urgent: "var(--status-urgent)",
          today: "var(--status-today)",
          completed: "var(--status-completed)",
          recurring: "var(--status-recurring)",
        },
        // Adicionando as cores da sidebar diretamente para que @apply possa encontrá-las
        'sidebar-background': "hsl(var(--sidebar-background))",
        'sidebar-foreground': "hsl(var(--sidebar-foreground))",
        'sidebar-primary': "hsl(var(--sidebar-primary))",
        'sidebar-primary-foreground': "hsl(var(--sidebar-primary-foreground))",
        'sidebar-accent': "hsl(var(--sidebar-accent))",
        'sidebar-accent-foreground': "hsl(var(--sidebar-accent-foreground))",
        'sidebar-border': "hsl(var(--sidebar-border))",
        'sidebar-ring': "hsl(var(--sidebar-ring))",
      },
      borderRadius: {
        lg: "var(--radius)", // Padrão para componentes maiores
        md: "calc(var(--radius) - 8px)", // Ajustado para ser menor que lg
        sm: "calc(var(--radius) - 12px)", // Ajustado para ser menor que md
        // Adicionando um radius maior para cards e botões, conforme solicitado (20px a 24px)
        "xl": "1.25rem", // 20px
        "2xl": "1.5rem", // 24px
        "3xl": "2rem", // 32px (para elementos maiores ou mais arredondados)
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Definindo Inter como a fonte principal
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Keyframes para o efeito de glow
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px hsla(var(--primary), 0.4), 0 0 10px hsla(var(--primary-light), 0.3)" },
          "50%": { boxShadow: "0 0 10px hsla(var(--primary), 0.6), 0 0 20px hsla(var(--primary-light), 0.5)" },
        },
        // Keyframes para fade + slide
        "fade-in-slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out-slide-down": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        glow: "glow 3s ease-in-out infinite", // Animação de glow contínua
        "fade-in-slide-up": "fade-in-slide-up 0.3s ease-out forwards",
        "fade-out-slide-down": "fade-out-slide-down 0.3s ease-out forwards",
      },
      boxShadow: {
        // Sombras personalizadas para profundidade
        "light-sm": "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
        "light-md": "0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
        "light-lg": "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",
        "glow-sm": "0 0 8px hsla(var(--primary), 0.5)", // Pequeno glow
        "glow-md": "0 0 15px hsla(var(--primary), 0.7)", // Médio glow
        "glow-lg": "0 0 25px hsla(var(--primary), 0.9)", // Grande glow
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;