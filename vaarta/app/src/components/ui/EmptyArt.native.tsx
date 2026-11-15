import LottieView from 'lottie-react-native';

/** Lottie empty-state animation (gold pulse rings + floating page). */
export function EmptyArt({ size = 150 }: { size?: number }) {
  return <LottieView source={require('../../../assets/lottie/empty.json')} autoPlay loop style={{ width: size, height: size }} />;
}
