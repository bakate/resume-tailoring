import { createInMemoryCandidateSessionPersistence, describeCandidateSessionPersistenceContract } from '@resume-tailoring/application/testing'

describeCandidateSessionPersistenceContract({
  name: 'In-memory Candidate Session persistence',
  createPersistence: ({ storedSession, storageAvailable }) =>
    createInMemoryCandidateSessionPersistence({ session: storedSession, storageAvailable }),
})
