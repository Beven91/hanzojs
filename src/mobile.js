import createHanzo from './createHanzo';

export default function (connect) {
  return createHanzo({
    mobile: true,
    connect: connect
  })
};