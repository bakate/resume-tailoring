import { createTheme } from '@mantine/core'

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

export const tailoredResumeDocumentStyles = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#151820;font-family:Arial,sans-serif}.resume-page{width:210mm;min-height:297mm;padding:17mm 18mm}header{border-bottom:.5mm solid #164f3d;padding-bottom:6mm}h1,h2{margin:0;color:#164f3d;font-family:Georgia,serif}h1{font-size:25pt}h2{font-size:14pt}header p,address{margin:3mm 0 0;font-style:normal}section{margin-top:6mm;break-inside:avoid}ul{margin:2mm 0 0;padding-left:5mm}li{margin-top:2mm;line-height:1.35}`
