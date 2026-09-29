import { createTheme } from '@mantine/core'

export const candidateJourneyTheme = createTheme({
  colors: {
    danger: [
      '#fff1f0',
      '#ffe0dd',
      '#ffc0ba',
      '#ff9d94',
      '#f9786d',
      '#e95b50',
      '#d9483e',
      '#b8322b',
      '#982f28',
      '#74231e',
    ],
    forest: [
      '#edf8f4',
      '#d8eee6',
      '#adddce',
      '#7fcbb4',
      '#5bbca0',
      '#42b28f',
      '#34ad87',
      '#26806a',
      '#1b5e4d',
      '#0f3d2f',
    ],
  },
  cursorType: 'pointer',
  defaultRadius: 'md',
  fontFamily: 'DM Sans, sans-serif',
  headings: { fontFamily: 'DM Serif Display, serif', fontWeight: '400' },
  primaryColor: 'forest',
  primaryShade: 8,
})
