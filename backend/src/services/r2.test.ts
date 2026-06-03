const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest
      .fn()
      .mockImplementation((params: unknown) => ({ __type: 'PutObjectCommand', params })),
    GetObjectCommand: jest
      .fn()
      .mockImplementation((params: unknown) => ({ __type: 'GetObjectCommand', params })),
  };
});

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mockGetSignedUrl }));

async function* iter(...bufs: Buffer[]): AsyncGenerator<Buffer> {
  for (const b of bufs) yield b;
}

type R2Module = {
  getPresignedPutUrl: () => Promise<{ url: string; key: string }>;
  getObjectBuffer: (key: string) => Promise<Buffer>;
  putObject: (key: string, buffer: Buffer, contentType?: string) => Promise<void>;
};

describe('services/r2', () => {
  const ORIGINAL_ENV = { ...process.env };
  let r2: R2Module;
  let S3Client: jest.Mock;
  let PutObjectCommand: jest.Mock;
  let GetObjectCommand: jest.Mock;

  beforeAll(() => {
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_BUCKET = 'test-bucket';

    // Require after env + mocks are set so the module-level S3Client uses our mock.
    r2 = require('./r2') as R2Module;
    ({ S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3') as {
      S3Client: jest.Mock;
      PutObjectCommand: jest.Mock;
      GetObjectCommand: jest.Mock;
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(() => {
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
    PutObjectCommand.mockClear();
    GetObjectCommand.mockClear();
  });

  test('S3Client was constructed with region, endpoint, and credentials from env', () => {
    expect(S3Client).toHaveBeenCalledTimes(1);
    expect(S3Client).toHaveBeenCalledWith({
      region: 'auto',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
  });

  describe('getPresignedPutUrl', () => {
    test('returns url+key, builds PutObjectCommand with webp content type, and signs with 3600s expiry', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://signed.example/x');

      const result = await r2.getPresignedPutUrl();

      expect(result.url).toBe('https://signed.example/x');
      expect(result.key).toMatch(/^photos\/[0-9a-f-]+\.webp$/);

      expect(PutObjectCommand).toHaveBeenCalledTimes(1);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: result.key,
        ContentType: 'image/webp',
      });

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      const [clientArg, commandArg, optsArg] = mockGetSignedUrl.mock.calls[0];
      expect(clientArg).toEqual({ send: mockSend });
      expect(commandArg).toEqual({
        __type: 'PutObjectCommand',
        params: { Bucket: 'test-bucket', Key: result.key, ContentType: 'image/webp' },
      });
      expect(optsArg).toEqual({ expiresIn: 3600 });
    });
  });

  describe('getObjectBuffer', () => {
    test('streams Body chunks into a single Buffer and constructs GetObjectCommand with bucket+key', async () => {
      mockSend.mockResolvedValueOnce({
        Body: iter(Buffer.from('hello '), Buffer.from('world')),
      });

      const buf = await r2.getObjectBuffer('some/key.webp');

      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.equals(Buffer.from('hello world'))).toBe(true);

      expect(GetObjectCommand).toHaveBeenCalledTimes(1);
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'some/key.webp',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        __type: 'GetObjectCommand',
        params: { Bucket: 'test-bucket', Key: 'some/key.webp' },
      });
    });
  });

  describe('putObject', () => {
    test('defaults ContentType to image/webp and sends a PutObjectCommand', async () => {
      mockSend.mockResolvedValueOnce(undefined);

      const body = Buffer.from('data');
      await r2.putObject('k', body);

      expect(PutObjectCommand).toHaveBeenCalledTimes(1);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'k',
        Body: body,
        ContentType: 'image/webp',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        __type: 'PutObjectCommand',
        params: {
          Bucket: 'test-bucket',
          Key: 'k',
          Body: body,
          ContentType: 'image/webp',
        },
      });
    });

    test('propagates a custom ContentType such as image/jpeg', async () => {
      mockSend.mockResolvedValueOnce(undefined);

      const body = Buffer.from('data');
      await r2.putObject('k', body, 'image/jpeg');

      expect(PutObjectCommand).toHaveBeenCalledTimes(1);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'k',
        Body: body,
        ContentType: 'image/jpeg',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
