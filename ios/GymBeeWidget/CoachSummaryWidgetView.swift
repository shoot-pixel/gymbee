import SwiftUI
import WidgetKit

// MARK: - Colors
//
// Same palette as src/theme/tokens.ts, with a light counterpart added since
// (unlike the app, which is dark-only) a Home Screen widget sits on whatever
// theme the user's actual home screen is in. `accent.primaryPressed`
// (#00C67C) — already in tokens.ts for exactly this "needs more contrast on
// a light background" situation — is reused as-is for the light accent
// rather than inventing a new green.

private extension Color {
    init(light: UIColor, dark: UIColor) {
        self.init(UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}

enum WidgetColors {
    static let bg = Color(
        light: .white,
        dark: UIColor(red: 0x1D / 255, green: 0x22 / 255, blue: 0x2C / 255, alpha: 1)
    )
    static let textPrimary = Color(
        light: UIColor(red: 0x14 / 255, green: 0x16 / 255, blue: 0x1A / 255, alpha: 1),
        dark: UIColor(red: 0xF2 / 255, green: 0xF4 / 255, blue: 0xF7 / 255, alpha: 1)
    )
    static let textSecondary = Color(
        light: UIColor(red: 0x62 / 255, green: 0x66 / 255, blue: 0x6F / 255, alpha: 1),
        dark: UIColor(red: 0xA7 / 255, green: 0xAF / 255, blue: 0xBD / 255, alpha: 1)
    )
    static let textTertiary = Color(
        light: UIColor(red: 0x94 / 255, green: 0x98 / 255, blue: 0xA0 / 255, alpha: 1),
        dark: UIColor(red: 0x73 / 255, green: 0x7C / 255, blue: 0x8C / 255, alpha: 1)
    )
    static let divider = Color(light: UIColor(white: 0, alpha: 0.09), dark: UIColor(white: 1, alpha: 0.08))
    /// "Ready" — high/moderate readiness, or a completed workout.
    static let good = Color(
        light: UIColor(red: 0x00 / 255, green: 0xA8 / 255, blue: 0x70 / 255, alpha: 1),
        dark: UIColor(red: 0x00 / 255, green: 0xE3 / 255, blue: 0x8E / 255, alpha: 1)
    )
    /// "Ease in" — low/very-low readiness.
    static let warn = Color(
        light: UIColor(red: 0xA5 / 255, green: 0x67 / 255, blue: 0x0C / 255, alpha: 1),
        dark: UIColor(red: 0xFF / 255, green: 0xB4 / 255, blue: 0x54 / 255, alpha: 1)
    )
    /// Rest day, or no readiness data yet — deliberately colorless so it
    /// never competes with "good"/"warn" for attention at a glance.
    static let neutral = textTertiary
}

// MARK: - Badge

private enum BadgeGlyph {
    case bolt, moon, check, info

    var systemName: String {
        switch self {
        case .bolt: return "bolt.fill"
        case .moon: return "moon.fill"
        case .check: return "checkmark"
        case .info: return "info"
        }
    }
}

/// Mirrors AiSummaryCard's `iconFor(band, isRestDay)` on the Home tab, with
/// one deliberate difference: the in-app card always tints its icon accent
/// green regardless of band, since it's a card you're already reading. A
/// widget is competing with two dozen other icons on a home screen, so this
/// colors the badge by band too — glanceability matters more here.
private func badgeGlyph(for payload: WidgetPayload) -> BadgeGlyph {
    if payload.plan.kind == "completed" { return .check }
    if payload.isRestDay { return .moon }
    switch payload.band {
    case "high", "moderate": return .bolt
    case "low", "very_low": return .moon
    default: return .info
    }
}

private func badgeColor(for payload: WidgetPayload) -> Color {
    if payload.plan.kind == "completed" { return WidgetColors.good }
    if payload.isRestDay { return WidgetColors.neutral }
    switch payload.band {
    case "high", "moderate": return WidgetColors.good
    case "low", "very_low": return WidgetColors.warn
    default: return WidgetColors.neutral
    }
}

private struct BadgeView: View {
    let payload: WidgetPayload
    var size: CGFloat = 26

    var body: some View {
        let glyph = badgeGlyph(for: payload)
        Circle()
            .fill(badgeColor(for: payload))
            .frame(width: size, height: size)
            .overlay(
                Image(systemName: glyph.systemName)
                    .font(.system(size: size * 0.42, weight: .bold))
                    .foregroundColor(.white)
            )
    }
}

// MARK: - Small

struct SmallWidgetView: View {
    let payload: WidgetPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BadgeView(payload: payload)
            Spacer(minLength: 8)
            Text(payload.headline)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(WidgetColors.textPrimary)
                .lineLimit(2)
            Spacer(minLength: 8)
            Rectangle().fill(WidgetColors.divider).frame(height: 1)
            VStack(alignment: .leading, spacing: 1) {
                Text(payload.plan.title ?? "Nothing planned")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(payload.plan.title == nil ? WidgetColors.textTertiary : WidgetColors.textPrimary)
                    .lineLimit(1)
                if let meta = payload.plan.meta {
                    Text(meta)
                        .font(.system(size: 10.5))
                        .foregroundColor(WidgetColors.textTertiary)
                        .lineLimit(1)
                }
            }
            .padding(.top, 7)
        }
    }
}

// MARK: - Medium

struct MediumWidgetView: View {
    let payload: WidgetPayload

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                BadgeView(payload: payload, size: 22)
                Text(payload.headline)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(WidgetColors.textPrimary)
                    .padding(.top, 4)
                    .lineLimit(1)
                Text(payload.summary)
                    .font(.system(size: 12))
                    .foregroundColor(WidgetColors.textSecondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Rectangle().fill(WidgetColors.divider).frame(width: 1)

            VStack(alignment: .leading, spacing: 4) {
                Text(payload.plan.label.uppercased())
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.3)
                    .foregroundColor(WidgetColors.textTertiary)
                Text(payload.plan.title ?? "Nothing planned")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(payload.plan.title == nil ? WidgetColors.textTertiary : WidgetColors.textPrimary)
                    .lineLimit(1)
                if let meta = payload.plan.meta {
                    Text(meta)
                        .font(.system(size: 11))
                        .foregroundColor(WidgetColors.textTertiary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Large

struct LargeWidgetView: View {
    let payload: WidgetPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                BadgeView(payload: payload, size: 22)
                Text("COACH SUMMARY")
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.3)
                    .foregroundColor(WidgetColors.textTertiary)
                Spacer()
                HStack(spacing: 3) {
                    Image(systemName: "clock")
                        .font(.system(size: 10))
                    Text(updatedTimeText)
                        .font(.system(size: 10, weight: .medium))
                }
                .foregroundColor(WidgetColors.textTertiary)
            }

            Text(payload.headline)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(WidgetColors.textPrimary)
                .padding(.top, 12)
                .padding(.bottom, 6)
                .lineLimit(1)

            Text(payload.summary)
                .font(.system(size: 13))
                .foregroundColor(WidgetColors.textSecondary)
                .lineLimit(4)
                .fixedSize(horizontal: false, vertical: true)

            Rectangle().fill(WidgetColors.divider).frame(height: 1).padding(.vertical, 15)

            Text("TODAY'S PLAN")
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.3)
                .foregroundColor(WidgetColors.textTertiary)
                .padding(.bottom, 10)

            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(payload.plan.title ?? "Nothing planned")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(payload.plan.title == nil ? WidgetColors.textTertiary : WidgetColors.textPrimary)
                        .lineLimit(1)
                    if let meta = payload.plan.meta {
                        Text(meta)
                            .font(.system(size: 12))
                            .foregroundColor(WidgetColors.textTertiary)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(WidgetColors.textTertiary)
            }

            Spacer(minLength: 12)

            if let sessions = payload.sessionsThisWeek, let target = payload.weeklyTarget, target > 0 {
                Text("\(sessions) of \(target) sessions this week")
                    .font(.system(size: 11))
                    .foregroundColor(WidgetColors.textTertiary)
            }
        }
    }

    private var updatedTimeText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: payload.updatedAt)
    }
}

// MARK: - Lock Screen (accessoryRectangular)

/// No background, no color — the Lock Screen renders this family in its own
/// vibrant monochrome material regardless of what's set here, so this only
/// ever specifies text, an SF Symbol, and layout.
struct AccessoryRectangularWidgetView: View {
    let payload: WidgetPayload

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: badgeGlyph(for: payload).systemName)
                .font(.system(size: 18))
            VStack(alignment: .leading, spacing: 1) {
                Text(payload.plan.title ?? payload.headline)
                    .font(.system(size: 12.5, weight: .semibold))
                    .lineLimit(1)
                Text(payload.plan.meta ?? payload.headline)
                    .font(.system(size: 11))
                    .lineLimit(1)
                    .opacity(0.8)
            }
        }
    }
}

// MARK: - Empty state (payload missing, or stale from before local midnight)

struct WidgetEmptyStateView: View {
    let family: WidgetFamily

    var body: some View {
        if family == .accessoryRectangular {
            HStack(spacing: 6) {
                Image(systemName: "arrow.clockwise")
                Text("Open SetSocial to sync")
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "arrow.clockwise.circle")
                    .font(.system(size: 22))
                    .foregroundColor(WidgetColors.textTertiary)
                Text("Open SetSocial")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(WidgetColors.textPrimary)
                Text("to sync today's summary")
                    .font(.system(size: 12))
                    .foregroundColor(WidgetColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - Root

private struct WidgetBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(WidgetColors.bg, for: .widget)
        } else {
            content.background(WidgetColors.bg)
        }
    }
}

struct CoachSummaryWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CoachEntry

    /// nil when there's no payload yet, or the stored one predates today —
    /// both render as the same "open the app" empty state rather than
    /// showing stale numbers under the wrong date.
    private var validPayload: WidgetPayload? {
        guard let payload = entry.payload, payload.dateKey == entry.todayKey else { return nil }
        return payload
    }

    var body: some View {
        if family == .accessoryRectangular {
            Group {
                if let payload = validPayload {
                    AccessoryRectangularWidgetView(payload: payload)
                } else {
                    WidgetEmptyStateView(family: family)
                }
            }
        } else {
            Group {
                if let payload = validPayload {
                    switch family {
                    case .systemSmall:
                        SmallWidgetView(payload: payload)
                    case .systemLarge:
                        LargeWidgetView(payload: payload)
                    default:
                        MediumWidgetView(payload: payload)
                    }
                } else {
                    WidgetEmptyStateView(family: family)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(family == .systemSmall ? 14 : 16)
            .modifier(WidgetBackgroundModifier())
        }
    }
}
