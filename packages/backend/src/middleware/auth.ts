import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const TENANT_ID = process.env.AZURE_TENANT_ID || 'common';
const CLIENT_ID = process.env.AZURE_CLIENT_ID || '';

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

export interface AuthUser {
  oid: string;    // Entra object ID
  email: string;
  name: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Auth middleware — validates JWT from Entra ID.
 * If AZURE_CLIENT_ID is not set, runs in dev mode (no auth required).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Dev mode: skip auth if no client ID configured
  if (!CLIENT_ID) {
    req.user = {
      oid: 'dev-user',
      email: 'dev@localhost',
      name: 'Dev User',
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ['RS256'],
      audience: CLIENT_ID,
      issuer: TENANT_ID === 'common'
        ? undefined  // skip issuer check for multi-tenant
        : `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    },
    (err, decoded) => {
      if (err) {
        console.error('JWT verification failed:', err.message);
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      const payload = decoded as jwt.JwtPayload;
      req.user = {
        oid: payload.oid || payload.sub || '',
        email: payload.preferred_username || payload.email || payload.upn || '',
        name: payload.name || payload.preferred_username || 'Unknown',
      };
      next();
    }
  );
}

/**
 * Optional auth — sets req.user if token present, continues either way.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!CLIENT_ID) {
    req.user = { oid: 'dev-user', email: 'dev@localhost', name: 'Dev User' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  jwt.verify(token, getKey, { algorithms: ['RS256'], audience: CLIENT_ID }, (err, decoded) => {
    if (!err && decoded) {
      const payload = decoded as jwt.JwtPayload;
      req.user = {
        oid: payload.oid || payload.sub || '',
        email: payload.preferred_username || payload.email || payload.upn || '',
        name: payload.name || payload.preferred_username || 'Unknown',
      };
    }
    next();
  });
}
