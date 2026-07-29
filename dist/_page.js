export function page(title, func) {
  // Return an object containing the title and the render function
  return {
    title: title,
    render: func
  };
}