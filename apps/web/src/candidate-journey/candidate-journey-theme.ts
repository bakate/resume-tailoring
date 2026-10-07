import { createTheme } from '@mantine/core'
import type { CSSVariablesResolver } from '@mantine/core'

export const candidateJourneyTheme = createTheme({
  colors: {
    caution: [
      '#fff8e6', '#ffefbf', '#ffe494', '#ffd866', '#ffcd3f',
      '#f5b800', '#d99d00', '#ad7900', '#805800', '#543900',
    ],
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
    informative: [
      '#edf5ff', '#dce8f8', '#b8d0ef', '#91b6e6', '#6fa0de',
      '#578fd9', '#4986d7', '#3974bf', '#2d66ac', '#1c5798',
    ],
  },
  cursorType: 'pointer',
  defaultRadius: 'md',
  fontFamily: 'DM Sans, sans-serif',
  headings: { fontFamily: 'DM Serif Display, serif', fontWeight: '400' },
  primaryColor: 'forest',
  primaryShade: 8,
})

/**
 * Secondary text and placeholders meet the WCAG AA 4.5:1 text contrast on the white and tinted surfaces; Mantine's
 * gray defaults reach only 3.3:1 and 2.1:1.
 */
export const candidateJourneyCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { '--mantine-color-dimmed': '#646b75', '--mantine-color-placeholder': '#6b7280' },
  dark: {},
})
