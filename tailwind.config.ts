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
          DEFAULT: "hsl(var(--secondary))", // Azul neon suave
          foreground: "hsl(var(--secondary-foreground))", // Texto para o azul neon
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
          overdue: "var(--status-overdue)", // Roxo forte
          urgent: "var(--status-urgent)",   // Azul vibrante
          today: "var(--status-today)",     // Verde suave
          completed: "var(--status-completed)", // Cinza translúcido
          recurring: "var(--status-recurring)", // Lilás
        },
        // Cores específicas para a Sidebar
        'sidebar-background': 'hsl(220 15% 10%)',
        'sidebar-foreground': 'hsl(210 20% 90%)',
        'sidebar-primary': 'hsl(228 100% 67%)',
        'sidebar-primary-foreground': 'hsl(210 20% 98%)',
        'sidebar-accent': 'hsl(220 15% 18%)',
        'sidebar-accent-foreground': 'hsl(210 20% 98%)',
        'sidebar-border': 'hsl(220 15% 25%)',
        'sidebar-ring': 'hsl(228 100% 67%)',
      },
      borderRadius: {
        lg: "var(--radius)", // Padrão para componentes maiores
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Adicionando um radius maior para cards e botões, conforme solicitado (16px a 24px)
        "xl": "1rem", // 16px
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
          "0%, 100%": { boxShadow: "0 0 5px rgba(95, 119, 255, 0.4), 0 0 10px rgba(76, 46, 255, 0.3)" },
          "50%": { boxShadow: "0 0 10px rgba(95, 119, 255, 0.6), 0 0 20px rgba(76, 46, 255, 0.5)" },
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
        "glow-sm": "0 0 8px rgba(95, 119, 255, 0.5)", // Pequeno glow
        "glow-md": "0 0 15px rgba(95, 119, 255, 0.7)", // Médio glow
        "glow-lg": "0 0 25px rgba(95, 119, 255, 0.9)", // Grande glow
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;