// ============================================================
// gen_style.ts — Generate the style.rs theme file
// ============================================================

import { GenContext } from './types.js';

/**
 * Generate a style.rs file based on the example project's style.
 * This is a standalone theme file users can customize.
 */
export function generateStyle(_ctx: GenContext): string {
  return `// ============================================================
// style.rs — Theme & style definitions (auto-generated)
//
// Modify this file to customize the look and feel.
// All colours, radii, shadows are defined here.
// ============================================================

use iced::border::Radius;
use iced::widget::{button, container, text_input};
use iced::{Background, Border, Color, Shadow, Theme, Vector};

// ── Dual-mode colour palette ────────────────────────────────

#[derive(Debug, Clone, Copy)]
pub struct Palette {
    pub bg:          Color,
    pub surface:     Color,
    pub surface_alt: Color,
    pub border:      Color,
    pub text:        Color,
    pub text_muted:  Color,
    pub shadow:      Color,
}

const LIGHT: Palette = Palette {
    bg:          Color::from_rgb(0.976, 0.980, 0.988),
    surface:     Color::from_rgb(1.0, 1.0, 1.0),
    surface_alt: Color::from_rgb(0.953, 0.957, 0.965),
    border:      Color::from_rgb(0.910, 0.918, 0.929),
    text:        Color::from_rgb(0.129, 0.145, 0.176),
    text_muted:  Color::from_rgb(0.439, 0.467, 0.529),
    shadow:      Color::from_rgba(0.0, 0.0, 0.0, 0.08),
};

const DARK: Palette = Palette {
    bg:          Color::from_rgb(0.098, 0.106, 0.122),
    surface:     Color::from_rgb(0.149, 0.161, 0.184),
    surface_alt: Color::from_rgb(0.118, 0.129, 0.149),
    border:      Color::from_rgb(0.220, 0.235, 0.263),
    text:        Color::from_rgb(0.906, 0.914, 0.929),
    text_muted:  Color::from_rgb(0.580, 0.604, 0.651),
    shadow:      Color::from_rgba(0.0, 0.0, 0.0, 0.25),
};

fn palette(theme: &Theme) -> &'static Palette {
    match theme {
        Theme::Dark => &DARK,
        _ => &LIGHT,
    }
}

// ── Accent colours ──────────────────────────────────────────

pub const ACCENT: Color       = Color::from_rgb(0.231, 0.510, 0.965);
pub const ACCENT_HOVER: Color = Color::from_rgb(0.369, 0.608, 1.0);
pub const DANGER: Color       = Color::from_rgb(0.937, 0.267, 0.267);
pub const DANGER_HOVER: Color = Color::from_rgb(0.960, 0.400, 0.400);
pub const SUCCESS: Color      = Color::from_rgb(0.133, 0.773, 0.369);
pub const WHITE: Color        = Color::from_rgb(1.0, 1.0, 1.0);

// ── Spacing / sizing constants ──────────────────────────────

pub const RADIUS_SM: f32 = 6.0;
pub const RADIUS_MD: f32 = 10.0;
pub const RADIUS_LG: f32 = 14.0;

// ── Shadows ─────────────────────────────────────────────────

fn card_shadow(p: &Palette) -> Shadow {
    Shadow {
        color: p.shadow,
        offset: Vector { x: 0.0, y: 4.0 },
        blur_radius: 16.0,
    }
}

fn subtle_shadow(p: &Palette) -> Shadow {
    Shadow {
        color: p.shadow,
        offset: Vector { x: 0.0, y: 2.0 },
        blur_radius: 8.0,
    }
}

// ── Public text colour helpers ──────────────────────────────

pub fn text_color(theme: &Theme) -> Color {
    palette(theme).text
}

pub fn text_muted_color(theme: &Theme) -> Color {
    palette(theme).text_muted
}

// ── Button styles ───────────────────────────────────────────

pub fn btn_primary(_theme: &Theme, status: button::Status) -> button::Style {
    let base = button::Style {
        background: Some(Background::Color(ACCENT)),
        text_color: WHITE,
        border: Border { radius: RADIUS_SM.into(), ..Border::default() },
        shadow: subtle_shadow(&LIGHT),
        snap: true,
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(ACCENT_HOVER)),
            ..base
        },
        _ => base,
    }
}

pub fn btn_danger(_theme: &Theme, status: button::Status) -> button::Style {
    let base = button::Style {
        background: Some(Background::Color(DANGER)),
        text_color: WHITE,
        border: Border { radius: RADIUS_SM.into(), ..Border::default() },
        shadow: subtle_shadow(&LIGHT),
        snap: true,
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(DANGER_HOVER)),
            ..base
        },
        _ => base,
    }
}

pub fn btn_ghost(theme: &Theme, status: button::Status) -> button::Style {
    let p = palette(theme);
    let base = button::Style {
        background: None,
        text_color: p.text_muted,
        border: Border { radius: RADIUS_SM.into(), ..Border::default() },
        shadow: Shadow::default(),
        snap: true,
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(p.surface_alt)),
            text_color: p.text,
            ..base
        },
        _ => base,
    }
}

pub fn btn_tab_inactive(theme: &Theme, status: button::Status) -> button::Style {
    let p = palette(theme);
    let base = button::Style {
        background: None,
        text_color: p.text_muted,
        border: Border { radius: RADIUS_SM.into(), ..Border::default() },
        shadow: Shadow::default(),
        snap: true,
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(p.border)),
            text_color: p.text,
            ..base
        },
        _ => base,
    }
}

pub fn btn_tab_active(_theme: &Theme, _status: button::Status) -> button::Style {
    button::Style {
        background: Some(Background::Color(ACCENT)),
        text_color: WHITE,
        border: Border { radius: RADIUS_SM.into(), ..Border::default() },
        shadow: subtle_shadow(&LIGHT),
        snap: true,
    }
}

pub fn btn_outlined(theme: &Theme, status: button::Status) -> button::Style {
    let p = palette(theme);
    let base = button::Style {
        background: Some(Background::Color(p.surface)),
        text_color: p.text,
        border: Border { radius: RADIUS_SM.into(), width: 1.0, color: p.border },
        shadow: Shadow::default(),
        snap: true,
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(p.surface_alt)),
            border: Border { color: ACCENT, ..base.border },
            text_color: ACCENT,
            ..base
        },
        _ => base,
    }
}

// ── Container styles ────────────────────────────────────────

pub fn app_background(theme: &Theme) -> container::Style {
    let p = palette(theme);
    container::Style {
        background: Some(Background::Color(p.bg)),
        ..container::Style::default()
    }
}

pub fn card(theme: &Theme) -> container::Style {
    let p = palette(theme);
    container::Style {
        background: Some(Background::Color(p.surface)),
        border: Border { radius: RADIUS_MD.into(), width: 1.0, color: p.border },
        shadow: card_shadow(p),
        ..container::Style::default()
    }
}

pub fn surface(theme: &Theme) -> container::Style {
    let p = palette(theme);
    container::Style {
        background: Some(Background::Color(p.surface)),
        ..container::Style::default()
    }
}

pub fn surface_alt(theme: &Theme) -> container::Style {
    let p = palette(theme);
    container::Style {
        background: Some(Background::Color(p.surface_alt)),
        ..container::Style::default()
    }
}

// ── Text input styles ───────────────────────────────────────

pub fn input_style(theme: &Theme, status: text_input::Status) -> text_input::Style {
    let p = palette(theme);
    let base = text_input::Style {
        background: Background::Color(p.surface),
        border: Border { radius: RADIUS_SM.into(), width: 1.0, color: p.border },
        icon: p.text_muted,
        placeholder: p.text_muted,
        value: p.text,
        selection: Color { a: 0.2, ..ACCENT },
    };
    match status {
        text_input::Status::Focused { is_hovered: _ } => text_input::Style {
            border: Border { color: ACCENT, width: 2.0, ..base.border },
            ..base
        },
        text_input::Status::Hovered => text_input::Style {
            border: Border { color: ACCENT_HOVER, ..base.border },
            ..base
        },
        _ => base,
    }
}
`;
}
