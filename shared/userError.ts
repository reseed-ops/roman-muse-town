/** An error whose message is safe and useful to show the visitor as it is
 *  (a limit, a full album): the town's HTTP layer passes it through with a
 *  422 instead of the generic "could not finish that" (Task 65). Never put
 *  anything private in one. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
