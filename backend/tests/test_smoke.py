"""Proves the harness itself works before any behaviour is asserted."""


async def test_health(client):
    res = await client.get("/listings")
    assert res.status_code == 200


async def test_reference_data_seeded(db):
    from sqlalchemy import text

    halls = (await db.execute(text("SELECT count(*) FROM halls"))).scalar_one()
    cats = (await db.execute(text("SELECT count(*) FROM categories"))).scalar_one()
    assert halls > 0
    assert cats > 0
