export class HttpResponse {
  private constructor(
    public readonly status: number,
    public readonly headers: Readonly<Record<string, string | string[]>>,
    public readonly body: any
  ) {
    Object.freeze(this);
    Object.freeze(this.headers);
    if (body && typeof body === "object") {
      Object.freeze(body);
    }
  }

  public static create(): HttpResponse {
    return new HttpResponse(200, {}, null);
  }

  public withStatus(status: number): HttpResponse {
    return new HttpResponse(status, this.headers, this.body);
  }

  public withHeader(name: string, value: string | string[]): HttpResponse {
    return new HttpResponse(
      this.status,
      Object.freeze({ ...this.headers, [name.toLowerCase()]: value }),
      this.body
    );
  }

  public withBody(body: any): HttpResponse {
    return new HttpResponse(this.status, this.headers, body);
  }

  public json(body: any): HttpResponse {
    return this.withHeader("content-type", "application/json").withBody(body);
  }
}
