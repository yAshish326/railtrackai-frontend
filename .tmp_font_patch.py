from pathlib import Path
import re
from difflib import unified_diff

files = [
    'src/assets/styles/enterprise.scss',
    'src/components/layout/Navbar.scss',
    'src/components/layout/Sidebar.scss',
    'src/pages/auth/ForgotPasswordPage.scss',
    'src/pages/auth/VerifyOtpPage.scss',
    'src/pages/dashboard/DashboardOverview.scss',
    'src/pages/dashboard/DashboardPage.scss',
    'src/pages/history/HistoryPage.scss',
    'src/pages/pnr/PnrEnquiryPage.scss',
    'src/pages/profile/ProfilePage.scss',
    'src/pages/settings/SettingsPage.scss',
    'src/pages/station/LiveStationBoardPage.scss',
    'src/pages/station/LiveStationBoardPageDate.scss',
    'src/pages/station/StationBoardPage.scss',
    'src/pages/train/SearchTrainPage.scss',
    'src/pages/train/TrainRoutePage.scss',
]

font_sizes = {
    0.75: '$font-size-micro',
    0.8: '$font-size-small',
    0.88: '$font-size-label',
    0.95: '$font-size-muted',
    1.0: '$font-size-body',
    1.25: '$font-size-card-title',
    1.5: '$font-size-section-title',
    2.25: '$font-size-page-title',
    2.5: '$font-size-hero',
}
font_weights = {
    400: '$font-weight-regular',
    500: '$font-weight-medium',
    600: '$font-weight-semibold',
    700: '$font-weight-bold',
    800: '$font-weight-heavy',
}

# sort keys for nearest search
size_keys = sorted(font_sizes.keys())
weight_keys = sorted(font_weights.keys())

def nearest_font_size(value):
    dist = [(abs(value - k), k) for k in size_keys]
    dist.sort()
    return font_sizes[dist[0][1]]

def nearest_font_weight(value):
    dist = [(abs(value - k), k) for k in weight_keys]
    dist.sort()
    return font_weights[dist[0][1]]

pattern_size = re.compile(r'(font-size:\s*)([0-9]+(?:\.[0-9]+)?)(px|rem)(\s*;)', re.MULTILINE)
pattern_weight = re.compile(r'(font-weight:\s*)([0-9]+)(\s*;)', re.MULTILINE)

for file in files:
    path = Path(file)
    if not path.exists():
        print(f'MISSING {file}')
        continue
    text = path.read_text(encoding='utf-8')
    newtext = text

    def repl_size(m):
        prefix, num, unit, suffix = m.groups()
        val = float(num)
        if unit == 'px':
            val = val / 16.0
        tok = nearest_font_size(val)
        return f"{prefix}{tok}{suffix}"

    def repl_weight(m):
        prefix, num, suffix = m.groups()
        val = int(num)
        tok = nearest_font_weight(val)
        return f"{prefix}{tok}{suffix}"

    newtext = pattern_size.sub(repl_size, newtext)
    newtext = pattern_weight.sub(repl_weight, newtext)

    if newtext != text:
        diff = unified_diff(text.splitlines(), newtext.splitlines(), fromfile=file, tofile=file, lineterm='')
        print(f'===== {file} =====')
        print('\n'.join(diff))
        path.write_text(newtext, encoding='utf-8')
