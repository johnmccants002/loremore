import { EmptyState, JournalScreen, Note } from '@/components/JournalScreen';

export default function Screen() {
  return (
    <JournalScreen eyebrow={"YOUR DAILY JOURNAL"} title={"A little more of today."} description={"The small moments. The passing thoughts. The things you’ll want to remember."}>
      <EmptyState icon="sunny-outline" title={"Your day starts here"}>{"Your captured moments will find a home here. Photo imports and quick notes are coming next."}</EmptyState>
      <Note title={"Capture → Context → Reflect → Story"}>{"Start with a moment. Add what it meant. Over time, see the story taking shape."}</Note>
    </JournalScreen>
  );
}
