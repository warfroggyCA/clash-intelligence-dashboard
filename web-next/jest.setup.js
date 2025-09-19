// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Load environment variables for testing
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local file for testing
config({ path: resolve(process.cwd(), '.env.local') })
