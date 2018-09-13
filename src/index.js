import createHanzo from './createHanzo';

export default function (connect) {
  return createHanzo({
    mobile: false,
    connect: connect
  })
};