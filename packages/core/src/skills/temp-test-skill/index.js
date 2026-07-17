module.exports = async function(input, context) {
  return { status: "dynamically-loaded-success", val: input ? input.val : undefined };
};
