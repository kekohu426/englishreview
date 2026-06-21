import { LessonItem } from "../../data/lesson";
import { ListenPickImage } from "./ListenPickImage";
import { ListenPickWord } from "./ListenPickWord";
import { ListenJudge } from "./ListenJudge";
import { ReadAloud } from "./ReadAloud";
import { WordOrder } from "./WordOrder";
import { FillBlank } from "./FillBlank";
import { MatchWordImage } from "./MatchWordImage";
import { SpellWord } from "./SpellWord";
import { TranslatePick } from "./TranslatePick";
import { DialogueComplete } from "./DialogueComplete";

interface Props { item: LessonItem; onCorrect: () => void; }

export function QuestionRouter({ item, onCorrect }: Props) {
  switch (item.type) {
    case "listen_pick_image":
      return <ListenPickImage item={item} onCorrect={onCorrect} />;
    case "listen_pick_word":
      return <ListenPickWord item={item} onCorrect={onCorrect} />;
    case "listen_judge":
      return <ListenJudge item={item} onCorrect={onCorrect} />;
    case "mixed_challenge":
      return <ListenPickWord item={item} onCorrect={onCorrect} badge="🎲 混合问答" badgeBg="#d7f0ff" />;
    case "read_aloud":
      return <ReadAloud item={item} onCorrect={onCorrect} />;
    case "word_order":
      return <WordOrder item={item} onCorrect={onCorrect} />;
    case "fill_blank":
      return <FillBlank item={item} onCorrect={onCorrect} />;
    case "match_word_image":
      return <MatchWordImage item={item} onCorrect={onCorrect} />;
    case "spell_word":
      return <SpellWord item={item} onCorrect={onCorrect} />;
    case "translate_pick":
      return <TranslatePick item={item} onCorrect={onCorrect} />;
    case "dialogue_complete":
      return <DialogueComplete item={item} onCorrect={onCorrect} />;
    default:
      return <div className="p-8 text-center text-[#6c7480]">未知题型: {item.type}</div>;
  }
}
