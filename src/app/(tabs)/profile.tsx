import { EmptyState, JournalScreen, Note } from '@/components/JournalScreen';

export default function Screen() {
  return (
    <JournalScreen eyebrow={"YOUR CORNER"} title={"A journal that’s yours."} description={"Your account, preferences, and privacy controls will have a home here."}>
      <EmptyState icon="person-outline" title={"Welcome to LoreMore"}>{"You’re exploring the first app preview. Account creation and sign-in are coming next."}</EmptyState>
      <Note title={"About this preview"}>{"These screens show the shape of LoreMore. No moments are being collected or uploaded yet."}</Note>
    </JournalScreen>
  );
}
