/**
 * App-wide colour tokens.
 * Tint colour matches the Streamlit dashboard's category colour for Daily.
 */
export const Colors = {
  light: {
    text: '#11181C',
    background: '#ffffff',
    tint: '#3498db',
    tabIconDefault: '#687076',
    tabIconSelected: '#3498db',
    card: '#f2f2f7',
    border: '#d1d1d6',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#3498db',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#3498db',
    card: '#1c1e1f',
    border: '#2d2f30',
  },
} as const;
