import { useLocalSearchParams } from 'expo-router';
import SubmitScreen from './index';

export default function EditSubmission() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SubmitScreen key={id} editId={id} />;
}
