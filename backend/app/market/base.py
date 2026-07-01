"""Provider abstraction for market data sources."""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from app.schemas.market import Candle


class MarketDataProvider(ABC):
    """Common interface every data source implements.

    `native_symbol` is the provider-specific symbol string (e.g. `BTCUSDT`,
    `EURUSD=X`, `GC=F`). The platform-level clean id → native mapping lives in
    `symbols.py`.
    """

    name: str = "base"

    @abstractmethod
    async def get_candles(
        self, native_symbol: str, interval: str, limit: int = 500
    ) -> list[Candle]:
        """Return historical OHLCV candles, oldest first."""
        raise NotImplementedError

    @abstractmethod
    def stream(self, native_symbol: str, interval: str) -> AsyncIterator[Candle]:
        """Yield live candle updates as they arrive.

        Implementations may use a true exchange WebSocket or a polling loop.
        Returns an async iterator of :class:`Candle`.
        """
        raise NotImplementedError
