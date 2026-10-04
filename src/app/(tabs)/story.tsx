import { EmptyState, JournalScreen, Note } from '@/components/JournalScreen';

export default function Screen() {
  return (
    <JournalScreen eyebrow={"THE BIGGER PICTURE"} title={"Life, in your words."} description={"A space to turn a day’s moments into something you can come back to."}>
      <EmptyState icon="book-outline" title={"The first page is still unwritten"}>{"Daily reflections and weekly stories will appear here as you build your journal."}</EmptyState>
      <Note title={"Yours to shape"}>{"You’ll be able to review and edit every story before choosing whether to share it."}</Note>
    </JournalScreen>
  );
}
