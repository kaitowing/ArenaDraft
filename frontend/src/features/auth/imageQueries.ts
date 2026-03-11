import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, documentId, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '#/lib/firebase'
import type { ImageDoc } from '#/types'

export function useProfileImage(uid: string | undefined) {
  return useQuery({
    queryKey: ['profile-image', uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'images', uid!))
      if (!snap.exists()) return null
      return (snap.data() as ImageDoc).base64
    },
    enabled: !!uid,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  })
}

export function usePrefetchProfileImages(uids: readonly string[]) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (uids.length === 0) return

    const uncached = uids.filter(
      (uid) => queryClient.getQueryState(['profile-image', uid]) === undefined,
    )
    if (uncached.length === 0) return

    const chunks: string[][] = []
    for (let i = 0; i < uncached.length; i += 30) {
      chunks.push(uncached.slice(i, i + 30))
    }

    void Promise.all(
      chunks.map((chunk) =>
        getDocs(query(collection(db, 'images'), where(documentId(), 'in', chunk))).then((snap) => {
          const found = new Map(snap.docs.map((d) => [d.id, (d.data() as ImageDoc).base64]))
          chunk.forEach((uid) => {
            queryClient.setQueryData(['profile-image', uid], found.get(uid) ?? null)
          })
        }),
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uids.join(',')])
}
